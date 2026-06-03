-- Add email marketing opt-in preference to profile
ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS email_marketing_opt_in BOOLEAN DEFAULT FALSE;
