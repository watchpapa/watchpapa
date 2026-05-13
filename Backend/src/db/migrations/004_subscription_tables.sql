-- Create all tables for the subscription and referral system.
-- Each table is intentionally separate from profile so free users carry no
-- extra columns and payment columns can be added here later without touching profile.

-- ─── user_subscriptions ────────────────────────────────────────────────────────
-- One row per user who holds a non-free tier. Free users have no row.
-- get_effective_tier() returns 'free' when no row is found.
CREATE TABLE public.user_subscriptions (
  id                        BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id                UUID          NOT NULL UNIQUE
                              REFERENCES public.profile(id) ON DELETE CASCADE,
  tier                      TEXT          NOT NULL
                              CHECK (tier IN ('premium', 'pro', 'pro_plus', 'god')),
  source                    TEXT          NOT NULL
                              CHECK (source IN ('early_adopter', 'referral', 'reward_code', 'admin', 'payment')),
  is_early_adopter          BOOLEAN       NOT NULL DEFAULT false,
  earned_pro_plus_on_payments BOOLEAN     NOT NULL DEFAULT false,
  expires_at                TIMESTAMPTZ,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

-- ─── referrals ─────────────────────────────────────────────────────────────────
-- Tracks who invited who and the state of the verification + reward process.
-- login_day_count and last_login_date track verification progress and are
-- nulled out once the referral is rewarded to keep the database clean.
CREATE TABLE public.referrals (
  id               BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  referrer_id      UUID          NOT NULL
                     REFERENCES public.profile(id) ON DELETE CASCADE,
  referred_id      UUID          NOT NULL UNIQUE
                     REFERENCES public.profile(id) ON DELETE CASCADE,
  status           TEXT          NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'rewarded', 'expired')),
  login_day_count  INT           NOT NULL DEFAULT 0
                     CHECK (login_day_count >= 0 AND login_day_count <= 2),
  last_login_date  DATE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  completed_at     TIMESTAMPTZ,
  CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referred_id)
);

CREATE INDEX referrals_referrer_id_idx ON public.referrals (referrer_id);
CREATE INDEX referrals_referred_id_idx ON public.referrals (referred_id);

-- ─── reward_codes ──────────────────────────────────────────────────────────────
-- Admin-created promo codes. god tier is excluded — admin sets that directly.
CREATE TABLE public.reward_codes (
  id            BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          TEXT          NOT NULL UNIQUE,
  tier          TEXT          NOT NULL
                  CHECK (tier IN ('premium', 'pro', 'pro_plus')),
  duration_days INT           CHECK (duration_days > 0),
  max_uses      INT           CHECK (max_uses > 0),
  current_uses  INT           NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

-- ─── reward_code_claims ────────────────────────────────────────────────────────
-- Records which user claimed which code. UNIQUE prevents double-claiming.
CREATE TABLE public.reward_code_claims (
  id          BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id     BIGINT        NOT NULL REFERENCES public.reward_codes(id) ON DELETE CASCADE,
  profile_id  UUID          NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  claimed_at  TIMESTAMPTZ   NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT reward_code_claims_unique UNIQUE (code_id, profile_id)
);

CREATE INDEX reward_code_claims_profile_id_idx ON public.reward_code_claims (profile_id);

-- ─── system_settings ───────────────────────────────────────────────────────────
-- Single admin-controlled key/value store. The payments_enabled_at row is the
-- gate that locks the lifetime-Pro milestone when billing goes live.
-- Admin sets this directly in the Supabase dashboard — no code deploy needed.
CREATE TABLE public.system_settings (
  key        TEXT         PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

INSERT INTO public.system_settings (key, value)
VALUES ('payments_enabled_at', NULL);
