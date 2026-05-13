-- Row Level Security for all subscription-system tables.
-- Read: users see only their own rows (or both sides of a referral).
-- Write: no policies for authenticated — all mutations go through SECURITY DEFINER functions.

-- ─── user_subscriptions ───────────────────────────────────────────────────────
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_subscriptions: own row read"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- ─── system_settings ──────────────────────────────────────────────────────────
-- No access for authenticated; admin reads/writes via service_role in dashboard.
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ─── referrals ────────────────────────────────────────────────────────────────
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals: participant read"
  ON public.referrals
  FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- ─── reward_codes ─────────────────────────────────────────────────────────────
ALTER TABLE public.reward_codes ENABLE ROW LEVEL SECURITY;

-- Regular users see only active, non-expired codes.
CREATE POLICY "reward_codes: active codes read"
  ON public.reward_codes
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );

-- ─── reward_code_claims ───────────────────────────────────────────────────────
ALTER TABLE public.reward_code_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reward_code_claims: own row read"
  ON public.reward_code_claims
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());
