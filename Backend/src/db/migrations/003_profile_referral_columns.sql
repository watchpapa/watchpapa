-- Add referral_code to profile.
-- This is the only column added to profile for the subscription system.
-- Everything else (subscriptions, referrals, reward codes) lives in dedicated tables.
-- pgcrypto is needed by the profile insert trigger (migration 006) to generate
-- cryptographically random referral codes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profile
  ADD COLUMN referral_code TEXT UNIQUE;
