-- 030_swap_functions_down.sql — cutover rollback. Restores the local-id function
-- bodies and re-adds the exclusive-or CHECKs. Only valid before 031 has run
-- (needs the content tables + old id columns, which 029 kept in place).

CREATE OR REPLACE FUNCTION public.get_community_rating_stats(p_media_type text, p_entity_id bigint)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
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
    'avg',   (SELECT ROUND(AVG(value)::numeric, 1) FROM rows),
    'histogram', COALESCE(
      (SELECT jsonb_object_agg(value, c) FROM (
        SELECT value, COUNT(*) AS c FROM rows GROUP BY value
      ) g), '{}'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_observed_ratings_for_entity(p_media_type text, p_entity_id bigint)
RETURNS TABLE (profile_id uuid, username text, value smallint, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.audit_user_follow_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_action text; v_method text; v_body jsonb; v_user uuid;
BEGIN
  v_user := COALESCE(auth.uid(), CASE TG_OP WHEN 'INSERT' THEN NEW.profile_id ELSE OLD.profile_id END);
  IF TG_OP = 'INSERT' THEN
    v_method := 'POST';
    IF TG_TABLE_NAME = 'user_followed_movies' THEN
      v_action := 'follow_movie'; v_body := jsonb_build_object('movie_id', NEW.movie_id);
    ELSIF TG_TABLE_NAME = 'user_followed_shows' THEN
      v_action := 'follow_show'; v_body := jsonb_build_object('show_id', NEW.show_id);
    ELSE RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_method := 'DELETE';
    IF TG_TABLE_NAME = 'user_followed_movies' THEN
      v_action := 'unfollow_movie'; v_body := jsonb_build_object('movie_id', OLD.movie_id);
    ELSIF TG_TABLE_NAME = 'user_followed_shows' THEN
      v_action := 'unfollow_show'; v_body := jsonb_build_object('show_id', OLD.show_id);
    ELSE RETURN OLD;
    END IF;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;
  INSERT INTO public.audit_events (action, user_id, email, ip, method, path, body)
  VALUES (v_action, v_user, NULL, NULL, v_method, 'direct/' || TG_TABLE_NAME, v_body);
  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER TABLE public.user_rating ADD CONSTRAINT user_rating_one_media CHECK (
  (((movie_id IS NOT NULL))::int + ((show_id IS NOT NULL))::int
   + ((season_id IS NOT NULL))::int + ((episode_id IS NOT NULL))::int) = 1
);
ALTER TABLE public.watchlist_item ADD CONSTRAINT watchlist_item_one_media CHECK (
  ((movie_id IS NOT NULL AND show_id IS NULL) OR (movie_id IS NULL AND show_id IS NOT NULL))
);
ALTER TABLE public.profile_favourite ADD CONSTRAINT profile_favourite_one_media CHECK (
  ((movie_id IS NOT NULL AND show_id IS NULL) OR (movie_id IS NULL AND show_id IS NOT NULL))
);