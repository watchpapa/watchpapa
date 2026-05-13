-- Core functions for the subscription system.
-- All subscription mutations go through these SECURITY DEFINER functions so
-- that the authenticated role can never write subscription data directly.

-- ─── _tier_rank ────────────────────────────────────────────────────────────────
-- Internal helper: maps tier names to integers for comparison.
-- Higher number = higher tier. Used by apply_tier_upgrade to decide whether
-- a new grant is actually an upgrade.
CREATE OR REPLACE FUNCTION public._tier_rank(t TEXT)
RETURNS INT
LANGUAGE sql IMMUTABLE PARALLEL SAFE
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

-- ─── get_effective_tier ────────────────────────────────────────────────────────
-- The single source of truth for what tier a user is actually on right now.
-- Called from the frontend (RPC) and from trigger functions.
--
-- Logic:
--   No row in user_subscriptions         → 'free'
--   tier = 'god'                          → 'god'  (god ignores expiry)
--   expires_at IS NULL OR expires_at > now() → tier (still active)
--   Expired + is_early_adopter = true     → 'premium' (permanent fallback)
--   Expired, not early adopter            → 'free'
CREATE OR REPLACE FUNCTION public.get_effective_tier(p_profile_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tier            TEXT;
  v_expires_at      TIMESTAMPTZ;
  v_is_early_adopter BOOLEAN;
BEGIN
  SELECT tier, expires_at, is_early_adopter
  INTO v_tier, v_expires_at, v_is_early_adopter
  FROM public.user_subscriptions
  WHERE profile_id = p_profile_id;

  IF NOT FOUND THEN
    RETURN 'free';
  END IF;

  IF v_tier = 'god' THEN
    RETURN 'god';
  END IF;

  IF v_expires_at IS NULL OR v_expires_at > now() THEN
    RETURN v_tier;
  END IF;

  IF v_is_early_adopter THEN
    RETURN 'premium';
  END IF;

  RETURN 'free';
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_tier(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_effective_tier(UUID) TO authenticated;

-- ─── apply_tier_upgrade ────────────────────────────────────────────────────────
-- The only sanctioned way to write subscription data.
-- Rejects 'god' — admin sets that directly in the dashboard.
-- No-op when new tier rank <= current effective rank AND the grant is timed
-- (a timed grant should never downgrade an existing higher tier).
-- Lifetime grants (p_duration_days IS NULL) always apply when rank >= current.
CREATE OR REPLACE FUNCTION public.apply_tier_upgrade(
  p_profile_id    UUID,
  p_tier          TEXT,
  p_duration_days INT,    -- NULL = lifetime
  p_source        TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_tier TEXT;
  v_new_expires  TIMESTAMPTZ;
BEGIN
  IF p_tier = 'god' THEN
    RAISE EXCEPTION 'god tier cannot be set programmatically';
  END IF;

  IF p_tier NOT IN ('free', 'premium', 'pro', 'pro_plus') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_tier;
  END IF;

  v_current_tier := public.get_effective_tier(p_profile_id);

  -- For timed grants: skip if new tier is not better than current.
  IF p_duration_days IS NOT NULL
    AND public._tier_rank(p_tier) <= public._tier_rank(v_current_tier)
  THEN
    RETURN;
  END IF;

  -- For lifetime grants: skip only if current tier is strictly higher.
  IF p_duration_days IS NULL
    AND public._tier_rank(p_tier) < public._tier_rank(v_current_tier)
  THEN
    RETURN;
  END IF;

  IF p_duration_days IS NULL THEN
    v_new_expires := NULL;
  ELSE
    v_new_expires := now() + (p_duration_days || ' days')::INTERVAL;
  END IF;

  INSERT INTO public.user_subscriptions
    (profile_id, tier, source, expires_at, updated_at)
  VALUES
    (p_profile_id, p_tier, p_source, v_new_expires, now())
  ON CONFLICT (profile_id) DO UPDATE
    SET tier       = EXCLUDED.tier,
        source     = EXCLUDED.source,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.apply_tier_upgrade(UUID, TEXT, INT, TEXT) FROM PUBLIC;

-- ─── check_referral_tasks ──────────────────────────────────────────────────────
-- Returns true when a referred user has done enough to count as a real person:
--   login_day_count >= 2 (on the referrals row)
--   AND combined follows >= 3
-- The account-age check (> 1 day) is done separately before creating the
-- referral row is not applicable here since tracking starts when the code is used.
CREATE OR REPLACE FUNCTION public.check_referral_tasks(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_login_count  INT;
  v_follow_count BIGINT;
BEGIN
  SELECT login_day_count
  INTO v_login_count
  FROM public.referrals
  WHERE referred_id = p_profile_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_login_count < 2 THEN
    RETURN false;
  END IF;

  SELECT
    (SELECT COUNT(*) FROM public.user_followed_shows  WHERE profile_id = p_profile_id)
    +
    (SELECT COUNT(*) FROM public.user_followed_movies WHERE profile_id = p_profile_id)
  INTO v_follow_count;

  RETURN v_follow_count >= 3;
END;
$$;

REVOKE ALL ON FUNCTION public.check_referral_tasks(UUID) FROM PUBLIC;

-- ─── record_login_day ──────────────────────────────────────────────────────────
-- Called from the frontend on every session load (safe to call repeatedly).
-- Increments login_day_count on the pending referrals row only when:
--   - A pending referral exists for this user
--   - login_day_count < 2
--   - last_login_date is NULL or earlier than today
-- All other calls are silent no-ops.
CREATE OR REPLACE FUNCTION public.record_login_day(p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.referrals
  SET
    login_day_count = login_day_count + 1,
    last_login_date  = CURRENT_DATE
  WHERE referred_id    = p_profile_id
    AND status         = 'pending'
    AND login_day_count < 2
    AND (last_login_date IS NULL OR last_login_date < CURRENT_DATE);
END;
$$;

REVOKE ALL ON FUNCTION public.record_login_day(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_login_day(UUID) TO authenticated;
