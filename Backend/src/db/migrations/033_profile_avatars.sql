-- User avatars: default (generated identicon, client-side, no column needed),
-- poster (a TMDB movie/show poster picked as an avatar — any tier), or upload
-- (a custom cropped photo — Pro/Pro+/God only, enforced both by a trigger here
-- and by the storage bucket's RLS policies below).

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS avatar_type TEXT NOT NULL DEFAULT 'default'
    CHECK (avatar_type IN ('default', 'poster', 'upload')),
  ADD COLUMN IF NOT EXISTS avatar_poster_media_type TEXT
    CHECK (avatar_poster_media_type IS NULL OR avatar_poster_media_type IN ('movie', 'show')),
  ADD COLUMN IF NOT EXISTS avatar_poster_tmdb_id INTEGER,
  ADD COLUMN IF NOT EXISTS avatar_poster_path TEXT,
  ADD COLUMN IF NOT EXISTS avatar_upload_path TEXT;

-- ─── Server-side tier enforcement for custom-photo avatars ───────────────────
-- Mirrors the guard-trigger pattern in 010_protect_sensitive_columns.sql: the
-- client-side UI already hides "Upload photo" below Pro, but this is the real
-- gate. Only checked at the moment avatar_type/avatar_upload_path changes to
-- 'upload' — a later downgrade does not retroactively clear an existing upload
-- (same "grandfathered" behaviour as early-adopter premium / watchlist limits).
CREATE OR REPLACE FUNCTION public.guard_avatar_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user = 'authenticated'
     AND NEW.avatar_type = 'upload'
     AND (OLD.avatar_type IS DISTINCT FROM NEW.avatar_type
          OR OLD.avatar_upload_path IS DISTINCT FROM NEW.avatar_upload_path)
  THEN
    IF public.get_effective_tier(NEW.id) NOT IN ('pro', 'pro_plus', 'god') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: custom photo avatars require Pro or higher'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_avatar_tier() FROM PUBLIC;

DROP TRIGGER IF EXISTS guard_profile_avatar_tier ON public.profile;
CREATE TRIGGER guard_profile_avatar_tier
  BEFORE UPDATE ON public.profile
  FOR EACH ROW EXECUTE FUNCTION public.guard_avatar_tier();

-- ─── Storage bucket for uploaded avatars ──────────────────────────────────────
-- Public read (so the URL can be hotlinked directly, same as the existing
-- "watchpapa - branding" bucket); writes restricted to the caller's own folder
-- (`${auth.uid()}/...`) and, for insert/update, to Pro+ tiers. Delete has no
-- tier check so a downgraded user can still remove their own upload.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_insert_own_pro" ON storage.objects;
CREATE POLICY "avatars_insert_own_pro"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.get_effective_tier(auth.uid()) IN ('pro', 'pro_plus', 'god')
  );

DROP POLICY IF EXISTS "avatars_update_own_pro" ON storage.objects;
CREATE POLICY "avatars_update_own_pro"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.get_effective_tier(auth.uid()) IN ('pro', 'pro_plus', 'god')
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Surface the new columns on the profile-list RPCs ────────────────────────
-- search_profiles / get_observers / get_observing back the "other user" rows
-- (UserSearchPage, ObserveListPage → UserResultRow). Same bodies, three extra
-- output columns each.
DROP FUNCTION IF EXISTS public.search_profiles(text, integer);
CREATE FUNCTION public.search_profiles(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE(
  id uuid, username text, bio text, is_private boolean, observe_status text,
  avatar_type text, avatar_poster_path text, avatar_upload_path text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    p.id,
    p.username,
    p.bio,
    p.is_private,
    (SELECT o.status FROM public.user_observe o
       WHERE o.observer_id = auth.uid() AND o.observed_id = p.id) AS observe_status,
    p.avatar_type,
    p.avatar_poster_path,
    p.avatar_upload_path
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

DROP FUNCTION IF EXISTS public.get_observers(uuid);
CREATE FUNCTION public.get_observers(p_profile_id uuid)
RETURNS TABLE(
  id uuid, username text, is_private boolean, observe_status text,
  avatar_type text, avatar_poster_path text, avatar_upload_path text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.can_view_ratings(auth.uid(), p_profile_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT pr.id, pr.username, pr.is_private,
      (SELECT o2.status FROM public.user_observe o2
         WHERE o2.observer_id = auth.uid() AND o2.observed_id = pr.id) AS observe_status,
      pr.avatar_type, pr.avatar_poster_path, pr.avatar_upload_path
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

DROP FUNCTION IF EXISTS public.get_observing(uuid);
CREATE FUNCTION public.get_observing(p_profile_id uuid)
RETURNS TABLE(
  id uuid, username text, is_private boolean, observe_status text,
  avatar_type text, avatar_poster_path text, avatar_upload_path text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.can_view_ratings(auth.uid(), p_profile_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT pr.id, pr.username, pr.is_private,
      (SELECT o2.status FROM public.user_observe o2
         WHERE o2.observer_id = auth.uid() AND o2.observed_id = pr.id) AS observe_status,
      pr.avatar_type, pr.avatar_poster_path, pr.avatar_upload_path
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
