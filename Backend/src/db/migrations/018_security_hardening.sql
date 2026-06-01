-- Security hardening based on Supabase security advisor findings.
-- Addresses two lint classes:
--   1. function_search_path_mutable  — 4 functions recreated with SET search_path
--   2. anon/authenticated SECURITY DEFINER function executable — explicit REVOKEs

-- ─── Part 1: Recreate functions with SET search_path ─────────────────────────

-- _tier_rank already had REVOKE ALL but was missing SET search_path.
CREATE OR REPLACE FUNCTION public._tier_rank(t TEXT)
RETURNS INT
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE t
    WHEN 'god'      THEN 5
    WHEN 'pro_plus' THEN 4
    WHEN 'pro'      THEN 3
    WHEN 'premium'  THEN 2
    WHEN 'free'     THEN 1
    ELSE 0
  END;
$$;
REVOKE ALL ON FUNCTION public._tier_rank(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._tier_rank(TEXT) FROM anon, authenticated;

-- enforce_watchlist_limit was missing both SET search_path and REVOKE.
CREATE OR REPLACE FUNCTION public.enforce_watchlist_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tier  TEXT;
  v_max   INT;
  v_count INT;
BEGIN
  SELECT get_effective_tier(NEW.profile_id) INTO v_tier;

  v_max := CASE v_tier
    WHEN 'free'     THEN 1
    WHEN 'premium'  THEN 3
    WHEN 'pro'      THEN 10
    WHEN 'pro_plus' THEN 10
    WHEN 'god'      THEN NULL
    ELSE 1
  END;

  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.watchlist
    WHERE profile_id = NEW.profile_id;

    IF v_count >= v_max THEN
      RAISE EXCEPTION 'WATCHLIST_LIMIT_REACHED: Your % plan allows up to % watchlist(s). Upgrade to create more.', v_tier, v_max;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_watchlist_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_watchlist_limit() FROM anon, authenticated;

-- get_profile_genre_stats had GRANT to authenticated but no REVOKE ALL first
-- (so PUBLIC — including anon — retained the default execute grant).
-- Also missing SET search_path.
CREATE OR REPLACE FUNCTION public.get_profile_genre_stats(p_profile_id UUID)
RETURNS TABLE (genre_name TEXT, rating_count BIGINT, avg_value NUMERIC)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    g.name                                  AS genre_name,
    COUNT(*)                                AS rating_count,
    ROUND(AVG(r.value)::NUMERIC, 1)         AS avg_value
  FROM   public.user_rating r
  LEFT JOIN public.movie       m  ON r.movie_id = m.id
  LEFT JOIN public.show        s  ON r.show_id  = s.id
  LEFT JOIN public.movie_genre mg ON m.id = mg.movie_id
  LEFT JOIN public.show_genre  sg ON s.id = sg.show_id
  LEFT JOIN public.genres      g  ON g.id = mg.genres_id OR g.id = sg.genres_id
  WHERE  r.profile_id = p_profile_id AND g.id IS NOT NULL
  GROUP  BY g.id, g.name
  ORDER  BY rating_count DESC
  LIMIT  20;
$$;
REVOKE ALL ON FUNCTION public.get_profile_genre_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_genre_stats(UUID) TO authenticated;

-- get_limit_status had GRANT to authenticated but no REVOKE ALL first,
-- and was also missing SET search_path.
CREATE OR REPLACE FUNCTION public.get_limit_status(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT get_effective_tier(p_profile_id) INTO v_tier;
  RETURN jsonb_build_object(
    'tier',            v_tier,
    'show_follows',    (SELECT COUNT(*) FROM public.user_followed_shows  WHERE profile_id = p_profile_id),
    'movie_follows',   (SELECT COUNT(*) FROM public.user_followed_movies WHERE profile_id = p_profile_id),
    'watchlist_count', (SELECT COUNT(*) FROM public.watchlist            WHERE profile_id = p_profile_id),
    'show_limit',      CASE v_tier WHEN 'free' THEN 3   WHEN 'premium' THEN NULL WHEN 'pro' THEN 100 WHEN 'pro_plus' THEN 100 WHEN 'god' THEN NULL ELSE 3   END,
    'movie_limit',     CASE v_tier WHEN 'free' THEN 1   WHEN 'premium' THEN NULL WHEN 'pro' THEN 100 WHEN 'pro_plus' THEN 100 WHEN 'god' THEN NULL ELSE 1   END,
    'combined_limit',  CASE v_tier WHEN 'premium' THEN 10 ELSE NULL END,
    'watchlist_limit', CASE v_tier WHEN 'free' THEN 1   WHEN 'premium' THEN 3   WHEN 'pro' THEN 10  WHEN 'pro_plus' THEN 10  WHEN 'god' THEN NULL ELSE 1   END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_limit_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_limit_status(UUID) TO authenticated;

-- ─── Part 2: Explicit REVOKEs — admin / internal / trigger functions ──────────
-- Belt-and-suspenders on top of REVOKE ALL FROM PUBLIC already in earlier
-- migrations; Supabase's linter detects per-role access separately.

-- apply_tier_upgrade: admin/service_role only — callers are SECURITY DEFINER
-- triggers (which run as the function owner, not as authenticated/anon).
-- Revoking here does not affect the trigger chain.
REVOKE EXECUTE ON FUNCTION public.apply_tier_upgrade(UUID, TEXT, INT, TEXT) FROM anon, authenticated;

-- Trigger functions (invoked by the DB engine, never directly by clients).
REVOKE EXECUTE ON FUNCTION public.audit_user_follow_change()        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_referral_on_follow()        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_referral_on_login()         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_follow_limit()            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_username_change_cooldown() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_sensitive_columns() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.issue_referral_rewards()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_profile_referral_code()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_early_adopter_subscription() FROM anon, authenticated;

-- Internal helpers: called only from the SECURITY DEFINER trigger chain.
REVOKE EXECUTE ON FUNCTION public.check_and_complete_referral(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_referral_tasks(UUID)        FROM anon, authenticated;

-- ─── Part 3: Revoke anon from authenticated-only RPC functions ───────────────
-- The REVOKEs already existed; these add explicit per-role revokes that the
-- Supabase linter checks for independently.

REVOKE EXECUTE ON FUNCTION public.get_effective_tier(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_login_day(UUID)   FROM anon;
REVOKE EXECUTE ON FUNCTION public.track_presence()         FROM anon;
REVOKE EXECUTE ON FUNCTION public.dismiss_banner(TEXT)     FROM anon;

-- Functions not defined in local migrations (created directly in Supabase).
-- Wrapped in DO blocks so a fresh-DB dry-run does not hard-fail.
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END;
$$;

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.complete_profile_username(TEXT) FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END;
$$;

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.delete_account() FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END;
$$;
