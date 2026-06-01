-- Social "Observe" feature: one-directional user following with public/private
-- accounts, blocking, and in-app notifications.
--
-- Vocabulary: verb "Observe"; your followers = "Observers"; people you follow =
-- "Observing". Public accounts are observed instantly; private accounts must
-- approve each request.
--
-- This migration adds:
--   1. profile.is_private column (opt-in private accounts)
--   2. user_observe, user_block, notification tables (+ RLS)
--   3. Triggers: auto accept/pending, notification creation, block-removes-observe
--   4. can_view_ratings() visibility helper + tightened user_rating RLS
--   5. SECURITY DEFINER RPCs for search, counts, lists, detail-page ratings,
--      request responses, activity feed, community histogram, and notifications

-- ─── 1. Private account flag ─────────────────────────────────────────────────
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- ─── 2a. user_observe ────────────────────────────────────────────────────────
-- observer_id observes observed_id. status is 'accepted' for public targets,
-- 'pending' until approved for private targets.
CREATE TABLE public.user_observe (
  id           BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  observer_id  UUID         NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  observed_id  UUID         NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  status       TEXT         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  accepted_at  TIMESTAMPTZ,
  CONSTRAINT user_observe_no_self CHECK (observer_id <> observed_id),
  UNIQUE (observer_id, observed_id)
);
CREATE INDEX user_observe_observer_idx ON public.user_observe (observer_id, status);
CREATE INDEX user_observe_observed_idx ON public.user_observe (observed_id, status);

-- ─── 2b. user_block ──────────────────────────────────────────────────────────
CREATE TABLE public.user_block (
  id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blocker_id  UUID         NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  blocked_id  UUID         NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT user_block_no_self CHECK (blocker_id <> blocked_id),
  UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX user_block_blocker_idx ON public.user_block (blocker_id);
CREATE INDEX user_block_blocked_idx ON public.user_block (blocked_id);

-- ─── 2c. notification ────────────────────────────────────────────────────────
CREATE TABLE public.notification (
  id            BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_id  UUID         NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  actor_id      UUID         REFERENCES public.profile(id) ON DELETE CASCADE,
  type          TEXT         NOT NULL CHECK (type IN ('new_observer', 'observe_request', 'request_accepted')),
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);
CREATE INDEX notification_recipient_idx ON public.notification (recipient_id, created_at DESC);
CREATE INDEX notification_unread_idx ON public.notification (recipient_id) WHERE read_at IS NULL;

-- ─── 3. Visibility helper ────────────────────────────────────────────────────
-- can_view_ratings(viewer, target): true when viewer may see target's ratings,
-- stats and observer/observing lists.
--   - self always allowed
--   - blocked (either direction) never allowed
--   - public target allowed for anyone
--   - private target allowed only to accepted observers
-- SECURITY DEFINER so it bypasses RLS on profile/user_observe/user_block and
-- can be safely referenced from RLS USING clauses without recursion.
CREATE OR REPLACE FUNCTION public.can_view_ratings(p_viewer UUID, p_target UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_target IS NULL THEN false
    WHEN p_viewer IS NOT NULL AND p_viewer = p_target THEN true
    WHEN p_viewer IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_block b
      WHERE (b.blocker_id = p_target AND b.blocked_id = p_viewer)
         OR (b.blocker_id = p_viewer AND b.blocked_id = p_target)
    ) THEN false
    WHEN COALESCE((SELECT pr.is_private FROM public.profile pr WHERE pr.id = p_target), true) = false THEN true
    WHEN p_viewer IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_observe o
      WHERE o.observer_id = p_viewer AND o.observed_id = p_target AND o.status = 'accepted'
    ) THEN true
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION public.can_view_ratings(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_ratings(UUID, UUID) TO anon, authenticated;

-- ─── 4. RLS policies ─────────────────────────────────────────────────────────

-- user_observe: a user sees rows where they are the observer or the observed.
ALTER TABLE public.user_observe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_observe: own relationships read"
  ON public.user_observe FOR SELECT TO authenticated
  USING (observer_id = auth.uid() OR observed_id = auth.uid());
-- Observer creates the row; the trigger decides accepted vs pending.
CREATE POLICY "user_observe: observer insert"
  ON public.user_observe FOR INSERT TO authenticated
  WITH CHECK (observer_id = auth.uid());
-- Either party may delete (observer unobserves/cancels; observed removes/denies).
-- Acceptance is handled by respond_observe_request() (SECURITY DEFINER), so no
-- UPDATE policy is granted to keep status tamper-proof.
CREATE POLICY "user_observe: either party delete"
  ON public.user_observe FOR DELETE TO authenticated
  USING (observer_id = auth.uid() OR observed_id = auth.uid());

-- user_block: blocker owns their block rows.
ALTER TABLE public.user_block ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_block: own rows read"
  ON public.user_block FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());
CREATE POLICY "user_block: own insert"
  ON public.user_block FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "user_block: own delete"
  ON public.user_block FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- notification: recipient reads and marks their own; inserts come from triggers.
ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification: recipient read"
  ON public.notification FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());
CREATE POLICY "notification: recipient update"
  ON public.notification FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
CREATE POLICY "notification: recipient delete"
  ON public.notification FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

-- user_rating: replace the blanket public-read policy with visibility gating.
-- Community aggregates move to get_community_rating_stats() (SECURITY DEFINER)
-- so private users' ratings still count anonymously.
DROP POLICY IF EXISTS "user_rating: public read" ON public.user_rating;
CREATE POLICY "user_rating: visibility read"
  ON public.user_rating FOR SELECT TO anon, authenticated
  USING (public.can_view_ratings(auth.uid(), profile_id));

-- ─── 5. Triggers ─────────────────────────────────────────────────────────────

-- BEFORE INSERT: block guard + set status based on target privacy.
CREATE OR REPLACE FUNCTION public.observe_set_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_private BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_block b
    WHERE (b.blocker_id = NEW.observed_id AND b.blocked_id = NEW.observer_id)
       OR (b.blocker_id = NEW.observer_id AND b.blocked_id = NEW.observed_id)
  ) THEN
    RAISE EXCEPTION 'OBSERVE_BLOCKED: cannot observe this user' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(is_private, false) INTO v_private FROM public.profile WHERE id = NEW.observed_id;

  IF v_private THEN
    NEW.status := 'pending';
    NEW.accepted_at := NULL;
  ELSE
    NEW.status := 'accepted';
    NEW.accepted_at := (now() AT TIME ZONE 'utc');
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.observe_set_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.observe_set_status() FROM anon, authenticated;

CREATE TRIGGER observe_set_status_trigger
  BEFORE INSERT ON public.user_observe
  FOR EACH ROW EXECUTE FUNCTION public.observe_set_status();

-- AFTER INSERT: notify the observed user (new observer or pending request).
CREATE OR REPLACE FUNCTION public.observe_notify_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notification (recipient_id, actor_id, type)
  VALUES (
    NEW.observed_id,
    NEW.observer_id,
    CASE WHEN NEW.status = 'accepted' THEN 'new_observer' ELSE 'observe_request' END
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.observe_notify_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.observe_notify_insert() FROM anon, authenticated;

CREATE TRIGGER observe_notify_insert_trigger
  AFTER INSERT ON public.user_observe
  FOR EACH ROW EXECUTE FUNCTION public.observe_notify_insert();

-- AFTER UPDATE: notify the observer when a pending request is accepted.
CREATE OR REPLACE FUNCTION public.observe_notify_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    INSERT INTO public.notification (recipient_id, actor_id, type)
    VALUES (NEW.observer_id, NEW.observed_id, 'request_accepted');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.observe_notify_accept() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.observe_notify_accept() FROM anon, authenticated;

CREATE TRIGGER observe_notify_accept_trigger
  AFTER UPDATE ON public.user_observe
  FOR EACH ROW EXECUTE FUNCTION public.observe_notify_accept();

-- AFTER INSERT on user_block: remove any observe relationship both directions.
CREATE OR REPLACE FUNCTION public.block_clear_observe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.user_observe
  WHERE (observer_id = NEW.blocker_id AND observed_id = NEW.blocked_id)
     OR (observer_id = NEW.blocked_id AND observed_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.block_clear_observe() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.block_clear_observe() FROM anon, authenticated;

CREATE TRIGGER block_clear_observe_trigger
  AFTER INSERT ON public.user_block
  FOR EACH ROW EXECUTE FUNCTION public.block_clear_observe();

-- ─── 6. RPCs ─────────────────────────────────────────────────────────────────

-- search_profiles: username search, excludes self + blocked, returns the
-- viewer's current observe status toward each result.
CREATE OR REPLACE FUNCTION public.search_profiles(p_query TEXT, p_limit INT DEFAULT 20)
RETURNS TABLE (id UUID, username TEXT, bio TEXT, is_private BOOLEAN, observe_status TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.id,
    p.username,
    p.bio,
    p.is_private,
    (SELECT o.status FROM public.user_observe o
       WHERE o.observer_id = auth.uid() AND o.observed_id = p.id) AS observe_status
  FROM public.profile p
  WHERE char_length(trim(COALESCE(p_query, ''))) >= 1
    AND p.username IS NOT NULL
    AND p.username ILIKE '%' || p_query || '%'
    AND p.id <> auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_block b
      WHERE (b.blocker_id = p.id AND b.blocked_id = auth.uid())
         OR (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
    )
  ORDER BY (p.username ILIKE p_query || '%') DESC, p.username ASC
  LIMIT LEAST(COALESCE(p_limit, 20), 50);
$$;
REVOKE ALL ON FUNCTION public.search_profiles(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_profiles(TEXT, INT) TO authenticated;

-- get_observe_counts: public counts (lists are gated, counts are not).
CREATE OR REPLACE FUNCTION public.get_observe_counts(p_profile_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'observers', (SELECT COUNT(*) FROM public.user_observe WHERE observed_id = p_profile_id AND status = 'accepted'),
    'observing', (SELECT COUNT(*) FROM public.user_observe WHERE observer_id = p_profile_id AND status = 'accepted')
  );
$$;
REVOKE ALL ON FUNCTION public.get_observe_counts(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_observe_counts(UUID) TO authenticated;

-- get_observers: people observing p_profile_id (gated by can_view_ratings).
CREATE OR REPLACE FUNCTION public.get_observers(p_profile_id UUID)
RETURNS TABLE (id UUID, username TEXT, is_private BOOLEAN, observe_status TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.can_view_ratings(auth.uid(), p_profile_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT pr.id, pr.username, pr.is_private,
      (SELECT o2.status FROM public.user_observe o2
         WHERE o2.observer_id = auth.uid() AND o2.observed_id = pr.id) AS observe_status
    FROM public.user_observe o
    JOIN public.profile pr ON pr.id = o.observer_id
    WHERE o.observed_id = p_profile_id AND o.status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_block b
        WHERE (b.blocker_id = pr.id AND b.blocked_id = auth.uid())
           OR (b.blocker_id = auth.uid() AND b.blocked_id = pr.id)
      )
    ORDER BY pr.username ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_observers(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_observers(UUID) TO authenticated;

-- get_observing: people p_profile_id observes (gated by can_view_ratings).
CREATE OR REPLACE FUNCTION public.get_observing(p_profile_id UUID)
RETURNS TABLE (id UUID, username TEXT, is_private BOOLEAN, observe_status TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.can_view_ratings(auth.uid(), p_profile_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT pr.id, pr.username, pr.is_private,
      (SELECT o2.status FROM public.user_observe o2
         WHERE o2.observer_id = auth.uid() AND o2.observed_id = pr.id) AS observe_status
    FROM public.user_observe o
    JOIN public.profile pr ON pr.id = o.observed_id
    WHERE o.observer_id = p_profile_id AND o.status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_block b
        WHERE (b.blocker_id = pr.id AND b.blocked_id = auth.uid())
           OR (b.blocker_id = auth.uid() AND b.blocked_id = pr.id)
      )
    ORDER BY pr.username ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_observing(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_observing(UUID) TO authenticated;

-- get_observed_ratings_for_entity: ratings by accepted-observed users for one
-- movie/show/season/episode. Powers the detail-page "people you observe" panel.
CREATE OR REPLACE FUNCTION public.get_observed_ratings_for_entity(p_media_type TEXT, p_entity_id BIGINT)
RETURNS TABLE (profile_id UUID, username TEXT, value SMALLINT, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pr.id, pr.username, r.value, r.created_at
  FROM public.user_observe o
  JOIN public.profile pr ON pr.id = o.observed_id
  JOIN public.user_rating r ON r.profile_id = o.observed_id
  WHERE o.observer_id = auth.uid()
    AND o.status = 'accepted'
    AND (
      (p_media_type = 'movie'   AND r.movie_id   = p_entity_id) OR
      (p_media_type = 'show'    AND r.show_id    = p_entity_id) OR
      (p_media_type = 'season'  AND r.season_id  = p_entity_id) OR
      (p_media_type = 'episode' AND r.episode_id = p_entity_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_block b
      WHERE (b.blocker_id = pr.id AND b.blocked_id = auth.uid())
         OR (b.blocker_id = auth.uid() AND b.blocked_id = pr.id)
    )
  ORDER BY r.value DESC, pr.username ASC;
$$;
REVOKE ALL ON FUNCTION public.get_observed_ratings_for_entity(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_observed_ratings_for_entity(TEXT, BIGINT) TO authenticated;

-- respond_observe_request: the observed user accepts or denies a pending request.
CREATE OR REPLACE FUNCTION public.respond_observe_request(p_observer_id UUID, p_accept BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;

  IF p_accept THEN
    UPDATE public.user_observe
       SET status = 'accepted', accepted_at = (now() AT TIME ZONE 'utc')
     WHERE observer_id = p_observer_id AND observed_id = auth.uid() AND status = 'pending';
  ELSE
    DELETE FROM public.user_observe
     WHERE observer_id = p_observer_id AND observed_id = auth.uid() AND status = 'pending';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_observe_request(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_observe_request(UUID, BOOLEAN) TO authenticated;

-- get_activity_feed: recent ratings by accepted-observed users, newest first.
-- Resolves show/season ids so the client can build detail links; filters adult
-- content unless p_include_adult.
CREATE OR REPLACE FUNCTION public.get_activity_feed(
  p_limit INT DEFAULT 30,
  p_offset INT DEFAULT 0,
  p_include_adult BOOLEAN DEFAULT false
)
RETURNS TABLE (
  rating_id   BIGINT,
  profile_id  UUID,
  username    TEXT,
  value       SMALLINT,
  rated_at    TIMESTAMPTZ,
  media_type  TEXT,
  title       TEXT,
  poster_path TEXT,
  movie_id    BIGINT,
  show_id     BIGINT,
  season_id   BIGINT,
  episode_id  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    r.id,
    r.profile_id,
    pr.username,
    r.value,
    r.created_at,
    CASE
      WHEN r.movie_id  IS NOT NULL THEN 'movie'
      WHEN r.show_id   IS NOT NULL THEN 'show'
      WHEN r.season_id IS NOT NULL THEN 'season'
      ELSE 'episode'
    END AS media_type,
    COALESCE(m.title, s.name, ssh.name, esh.name) AS title,
    COALESCE(m.poster_path, s.poster_path, se.poster_path, ssh.poster_path, esh.poster_path) AS poster_path,
    r.movie_id,
    COALESCE(r.show_id, se.show_id, esh.id) AS show_id,
    COALESCE(r.season_id, e.season_id) AS season_id,
    r.episode_id
  FROM public.user_observe o
  JOIN public.profile pr ON pr.id = o.observed_id
  JOIN public.user_rating r ON r.profile_id = o.observed_id
  LEFT JOIN public.movie  m   ON m.id  = r.movie_id
  LEFT JOIN public.show   s   ON s.id  = r.show_id
  LEFT JOIN public.season se  ON se.id = r.season_id
  LEFT JOIN public.show   ssh ON ssh.id = se.show_id
  LEFT JOIN public.episode e  ON e.id  = r.episode_id
  LEFT JOIN public.season ese ON ese.id = e.season_id
  LEFT JOIN public.show   esh ON esh.id = ese.show_id
  WHERE o.observer_id = auth.uid()
    AND o.status = 'accepted'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_block b
      WHERE (b.blocker_id = pr.id AND b.blocked_id = auth.uid())
         OR (b.blocker_id = auth.uid() AND b.blocked_id = pr.id)
    )
    AND (
      p_include_adult OR (
        COALESCE(m.adult, false) = false
        AND COALESCE(s.adult, false) = false
        AND COALESCE(ssh.adult, false) = false
        AND COALESCE(esh.adult, false) = false
      )
    )
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT LEAST(COALESCE(p_limit, 30), 60)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
REVOKE ALL ON FUNCTION public.get_activity_feed(INT, INT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_activity_feed(INT, INT, BOOLEAN) TO authenticated;

-- get_community_rating_stats: anonymous histogram/avg/total over ALL ratings
-- (including private users') for one entity. Replaces the direct user_rating
-- read the histogram used before RLS was tightened.
CREATE OR REPLACE FUNCTION public.get_community_rating_stats(p_media_type TEXT, p_entity_id BIGINT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH rows AS (
    SELECT r.value
    FROM public.user_rating r
    WHERE (p_media_type = 'movie'   AND r.movie_id   = p_entity_id)
       OR (p_media_type = 'show'    AND r.show_id    = p_entity_id)
       OR (p_media_type = 'season'  AND r.season_id  = p_entity_id)
       OR (p_media_type = 'episode' AND r.episode_id = p_entity_id)
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM rows),
    'avg',   (SELECT ROUND(AVG(value)::NUMERIC, 1) FROM rows),
    'histogram', COALESCE(
      (SELECT jsonb_object_agg(value, c) FROM (
        SELECT value, COUNT(*) AS c FROM rows GROUP BY value
      ) g),
      '{}'::jsonb
    )
  );
$$;
REVOKE ALL ON FUNCTION public.get_community_rating_stats(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_community_rating_stats(TEXT, BIGINT) TO anon, authenticated;

-- get_notifications: recipient's notifications with actor username, newest first.
CREATE OR REPLACE FUNCTION public.get_notifications(p_limit INT DEFAULT 30, p_offset INT DEFAULT 0)
RETURNS TABLE (
  id            BIGINT,
  type          TEXT,
  actor_id      UUID,
  actor_username TEXT,
  actor_is_private BOOLEAN,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT n.id, n.type, n.actor_id, pr.username, pr.is_private, n.read_at, n.created_at
  FROM public.notification n
  LEFT JOIN public.profile pr ON pr.id = n.actor_id
  WHERE n.recipient_id = auth.uid()
  ORDER BY n.created_at DESC, n.id DESC
  LIMIT LEAST(COALESCE(p_limit, 30), 60)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
REVOKE ALL ON FUNCTION public.get_notifications(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_notifications(INT, INT) TO authenticated;

-- get_unread_notification_count: badge counter.
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::INT FROM public.notification
  WHERE recipient_id = auth.uid() AND read_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.get_unread_notification_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;

-- mark_notifications_read: mark all (p_ids NULL) or specific notifications read.
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids BIGINT[] DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.notification
     SET read_at = (now() AT TIME ZONE 'utc')
   WHERE recipient_id = auth.uid()
     AND read_at IS NULL
     AND (p_ids IS NULL OR id = ANY(p_ids));
END;
$$;
REVOKE ALL ON FUNCTION public.mark_notifications_read(BIGINT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(BIGINT[]) TO authenticated;
