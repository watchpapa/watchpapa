-- Referral reward system: checks task completion and issues upgrades atomically.
-- All logic runs inside triggers so it cannot be gamed from outside the database.

-- ─── check_and_complete_referral ──────────────────────────────────────────────
-- Called from follow and login triggers.
-- If the referred user's pending referral now satisfies check_referral_tasks(),
-- advances its status to 'tasks_completed' (which fires issue_referral_rewards).
-- Uses SELECT FOR UPDATE to prevent two concurrent triggers racing on the same row.
CREATE OR REPLACE FUNCTION public.check_and_complete_referral(p_referred_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_referral_id BIGINT;
BEGIN
  SELECT id INTO v_referral_id
  FROM public.referrals
  WHERE referred_id = p_referred_id AND status = 'pending'
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT public.check_referral_tasks(p_referred_id) THEN
    RETURN;
  END IF;

  UPDATE public.referrals
  SET status = 'tasks_completed'
  WHERE id = v_referral_id;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_complete_referral(UUID) FROM PUBLIC;

-- ─── issue_referral_rewards ───────────────────────────────────────────────────
-- AFTER UPDATE trigger on referrals, fires only on pending → tasks_completed.
-- Determines rewards based on pool availability and referrer's early-adopter status,
-- applies upgrades, optionally grants lifetime Pro milestone, then marks rewarded.
CREATE OR REPLACE FUNCTION public.issue_referral_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payments_enabled_at  TIMESTAMPTZ;
  v_referrer_is_ea       BOOLEAN;
  v_pool_count           BIGINT;
  v_pool_has_slots       BOOLEAN;
  v_rewarded_count       BIGINT;
BEGIN
  -- Only fire on the specific status transition this trigger is meant for.
  IF OLD.status <> 'pending' OR NEW.status <> 'tasks_completed' THEN
    RETURN NEW;
  END IF;

  -- Read the payments gate.
  SELECT value::TIMESTAMPTZ INTO v_payments_enabled_at
  FROM public.system_settings
  WHERE key = 'payments_enabled_at';

  -- Is the referrer an early adopter?
  SELECT is_early_adopter INTO v_referrer_is_ea
  FROM public.user_subscriptions
  WHERE profile_id = NEW.referrer_id;

  v_referrer_is_ea := COALESCE(v_referrer_is_ea, false);

  -- How many early-adopter slots remain?
  SELECT COUNT(*) INTO v_pool_count
  FROM public.user_subscriptions
  WHERE is_early_adopter = true;

  v_pool_has_slots := v_pool_count < 5000;

  -- ── Referrer reward ──
  -- Pool has slots OR referrer is early adopter → Pro 30d
  -- Pool full, non-early-adopter                → Premium 30d
  IF v_pool_has_slots OR v_referrer_is_ea THEN
    PERFORM public.apply_tier_upgrade(NEW.referrer_id, 'pro', 30, 'referral');
  ELSE
    PERFORM public.apply_tier_upgrade(NEW.referrer_id, 'premium', 30, 'referral');
  END IF;

  -- ── Referred reward ──
  -- Pool has slots → Pro 30d; pool full → Premium 30d
  IF v_pool_has_slots THEN
    PERFORM public.apply_tier_upgrade(NEW.referred_id, 'pro', 30, 'referral');
  ELSE
    PERFORM public.apply_tier_upgrade(NEW.referred_id, 'premium', 30, 'referral');
  END IF;

  -- ── Lifetime Pro milestone ──
  -- Only early adopters qualify; only before payments go live.
  IF v_referrer_is_ea AND v_payments_enabled_at IS NULL THEN
    SELECT COUNT(*) INTO v_rewarded_count
    FROM public.referrals
    WHERE referrer_id = NEW.referrer_id
      AND status IN ('tasks_completed', 'rewarded');

    -- Count includes the current row (still tasks_completed at this point).
    IF v_rewarded_count >= 10 THEN
      PERFORM public.apply_tier_upgrade(NEW.referrer_id, 'pro', NULL, 'referral');

      UPDATE public.user_subscriptions
      SET earned_pro_plus_on_payments = true
      WHERE profile_id = NEW.referrer_id;
    END IF;
  END IF;

  -- Mark rewarded and clean up tracking data.
  -- login_day_count is NOT NULL so it resets to 0; last_login_date goes to NULL.
  UPDATE public.referrals
  SET status          = 'rewarded',
      completed_at    = now(),
      login_day_count = 0,
      last_login_date = NULL
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_referral_rewards() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_issue_referral_rewards ON public.referrals;
CREATE TRIGGER trg_issue_referral_rewards
  AFTER UPDATE OF status ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.issue_referral_rewards();

-- ─── check_referral_on_follow ─────────────────────────────────────────────────
-- Fires after a follow is inserted; checks if the 3rd follow just completed tasks.
CREATE OR REPLACE FUNCTION public.check_referral_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.check_and_complete_referral(NEW.profile_id);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.check_referral_on_follow() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_referral_on_show_follow  ON public.user_followed_shows;
DROP TRIGGER IF EXISTS trg_referral_on_movie_follow ON public.user_followed_movies;

CREATE TRIGGER trg_referral_on_show_follow
  AFTER INSERT ON public.user_followed_shows
  FOR EACH ROW EXECUTE FUNCTION public.check_referral_on_follow();

CREATE TRIGGER trg_referral_on_movie_follow
  AFTER INSERT ON public.user_followed_movies
  FOR EACH ROW EXECUTE FUNCTION public.check_referral_on_follow();

-- ─── check_referral_on_login ──────────────────────────────────────────────────
-- Fires after record_login_day increments login_day_count; checks if count=2
-- just completed tasks.
CREATE OR REPLACE FUNCTION public.check_referral_on_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.login_day_count IS DISTINCT FROM OLD.login_day_count THEN
    PERFORM public.check_and_complete_referral(NEW.referred_id);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.check_referral_on_login() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_referral_on_login ON public.referrals;
CREATE TRIGGER trg_referral_on_login
  AFTER UPDATE OF login_day_count ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.check_referral_on_login();
