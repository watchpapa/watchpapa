-- Add profile share permission setting
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS setting_allow_profile_share BOOLEAN NOT NULL DEFAULT false;
