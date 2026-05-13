-- Follow limit enforcement via BEFORE INSERT triggers on both follow tables.
-- Follows are written directly from the browser via the Supabase SDK and never
-- pass through the Express backend, so the database is the only enforcement point.

CREATE OR REPLACE FUNCTION public.enforce_follow_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tier         TEXT;
  v_show_count   BIGINT;
  v_movie_count  BIGINT;
  v_combined     BIGINT;
BEGIN
  v_tier := public.get_effective_tier(NEW.profile_id);

  -- God tier: unrestricted.
  IF v_tier = 'god' THEN
    RETURN NEW;
  END IF;

  IF v_tier = 'free' THEN
    IF TG_TABLE_NAME = 'user_followed_shows' THEN
      SELECT COUNT(*) INTO v_show_count
      FROM public.user_followed_shows
      WHERE profile_id = NEW.profile_id;

      IF v_show_count >= 3 THEN
        RAISE EXCEPTION 'FOLLOW_LIMIT_REACHED: free tier allows up to 3 followed shows'
          USING ERRCODE = 'P0001';
      END IF;

    ELSE
      SELECT COUNT(*) INTO v_movie_count
      FROM public.user_followed_movies
      WHERE profile_id = NEW.profile_id;

      IF v_movie_count >= 1 THEN
        RAISE EXCEPTION 'FOLLOW_LIMIT_REACHED: free tier allows up to 1 followed movie'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;

  ELSIF v_tier = 'premium' THEN
    SELECT
      (SELECT COUNT(*) FROM public.user_followed_shows  WHERE profile_id = NEW.profile_id)
      +
      (SELECT COUNT(*) FROM public.user_followed_movies WHERE profile_id = NEW.profile_id)
    INTO v_combined;

    IF v_combined >= 10 THEN
      RAISE EXCEPTION 'FOLLOW_LIMIT_REACHED: premium tier allows up to 10 combined followed items'
        USING ERRCODE = 'P0001';
    END IF;

  ELSIF v_tier IN ('pro', 'pro_plus') THEN
    IF TG_TABLE_NAME = 'user_followed_shows' THEN
      SELECT COUNT(*) INTO v_show_count
      FROM public.user_followed_shows
      WHERE profile_id = NEW.profile_id;

      IF v_show_count >= 100 THEN
        RAISE EXCEPTION 'FOLLOW_LIMIT_REACHED: pro tier allows up to 100 followed shows'
          USING ERRCODE = 'P0001';
      END IF;

    ELSE
      SELECT COUNT(*) INTO v_movie_count
      FROM public.user_followed_movies
      WHERE profile_id = NEW.profile_id;

      IF v_movie_count >= 100 THEN
        RAISE EXCEPTION 'FOLLOW_LIMIT_REACHED: pro tier allows up to 100 followed movies'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_follow_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_show_follow_limit  ON public.user_followed_shows;
DROP TRIGGER IF EXISTS enforce_movie_follow_limit ON public.user_followed_movies;

CREATE TRIGGER enforce_show_follow_limit
  BEFORE INSERT ON public.user_followed_shows
  FOR EACH ROW EXECUTE FUNCTION public.enforce_follow_limit();

CREATE TRIGGER enforce_movie_follow_limit
  BEFORE INSERT ON public.user_followed_movies
  FOR EACH ROW EXECUTE FUNCTION public.enforce_follow_limit();
