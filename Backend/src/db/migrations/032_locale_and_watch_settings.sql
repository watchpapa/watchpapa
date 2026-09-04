-- Content locale + streaming preferences (user-editable; covered by profile_update_own RLS)
ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS setting_language TEXT NOT NULL DEFAULT 'en-US'
    CHECK (setting_language ~ '^[a-z]{2}-[A-Z]{2}$'),
  ADD COLUMN IF NOT EXISTS setting_title_mode TEXT NOT NULL DEFAULT 'translated'
    CHECK (setting_title_mode IN ('translated', 'native_original')),
  ADD COLUMN IF NOT EXISTS setting_region TEXT
    CHECK (setting_region IS NULL OR setting_region ~ '^[A-Z]{2}$'),
  ADD COLUMN IF NOT EXISTS setting_watch_regions TEXT[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(setting_watch_regions) <= 5),
  ADD COLUMN IF NOT EXISTS setting_watch_providers INTEGER[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(setting_watch_providers) <= 60);
