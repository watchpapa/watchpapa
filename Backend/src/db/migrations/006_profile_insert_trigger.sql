-- Profile insert triggers: assigns referral_code (BEFORE) and early-adopter
-- subscription (AFTER). Two triggers because the referral_code must be set
-- before the row lands, while user_subscriptions needs the FK to already exist.

-- ─── set_profile_referral_code ────────────────────────────────────────────────
-- BEFORE INSERT: populates NEW.referral_code before the row is written.
CREATE OR REPLACE FUNCTION public.set_profile_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code    TEXT;
  v_attempt INT := 0;
BEGIN
  LOOP
    v_code := upper(
      translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=', '')
    );
    v_code := substring(v_code FROM 1 FOR 8);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profile WHERE referral_code = v_code
    );
    v_attempt := v_attempt + 1;
    IF v_attempt >= 10 THEN
      RAISE EXCEPTION 'Could not generate a unique referral code after 10 attempts';
    END IF;
  END LOOP;

  NEW.referral_code := v_code;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_profile_referral_code() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_set_profile_referral_code ON public.profile;
CREATE TRIGGER trg_set_profile_referral_code
  BEFORE INSERT ON public.profile
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_referral_code();

-- ─── grant_early_adopter_subscription ────────────────────────────────────────
-- AFTER INSERT: profile row now exists so the user_subscriptions FK resolves.
-- Counts rows at the time of insert; first 5000 get lifetime Premium.
CREATE OR REPLACE FUNCTION public.grant_early_adopter_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pool_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_pool_count FROM public.profile;

  -- The new row is already counted, so <= 5000 means this user is in the pool.
  IF v_pool_count <= 5000 THEN
    INSERT INTO public.user_subscriptions
      (profile_id, tier, source, is_early_adopter, expires_at, updated_at)
    VALUES
      (NEW.id, 'premium', 'early_adopter', true, NULL, now());
  END IF;

  RETURN NULL; -- AFTER trigger return value is ignored
END;
$$;

REVOKE ALL ON FUNCTION public.grant_early_adopter_subscription() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_grant_early_adopter_subscription ON public.profile;
CREATE TRIGGER trg_grant_early_adopter_subscription
  AFTER INSERT ON public.profile
  FOR EACH ROW EXECUTE FUNCTION public.grant_early_adopter_subscription();

-- ─── Backfill existing users ──────────────────────────────────────────────────
-- All users registered before this migration are grandfathered as early adopters.
-- Safe to re-run: UPDATE skips rows that already have a code; INSERT uses
-- ON CONFLICT DO NOTHING.
DO $$
DECLARE
  v_profile RECORD;
  v_code    TEXT;
  v_attempt INT;
BEGIN
  -- Generate referral codes for users who don't have one yet.
  FOR v_profile IN
    SELECT id FROM public.profile WHERE referral_code IS NULL
  LOOP
    v_attempt := 0;
    LOOP
      v_code := upper(
        translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=', '')
      );
      v_code := substring(v_code FROM 1 FOR 8);
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.profile WHERE referral_code = v_code
      );
      v_attempt := v_attempt + 1;
      IF v_attempt >= 10 THEN
        RAISE EXCEPTION 'Could not generate a unique referral code for profile % after 10 attempts', v_profile.id;
      END IF;
    END LOOP;

    UPDATE public.profile SET referral_code = v_code WHERE id = v_profile.id;
  END LOOP;

  -- Grant lifetime Premium to all existing users without a subscription row.
  INSERT INTO public.user_subscriptions
    (profile_id, tier, source, is_early_adopter, expires_at, updated_at)
  SELECT p.id, 'premium', 'early_adopter', true, NULL, now()
  FROM public.profile p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions us WHERE us.profile_id = p.id
  )
  ON CONFLICT (profile_id) DO NOTHING;
END;
$$;
