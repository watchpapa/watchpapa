-- "Show adult content" (setting_display_adult_content) is the general switch:
-- nsfw titles appear inline in browse/search/home. The hidden "Adult" tab in
-- the header is a separate opt-in on top of that — off by default so turning
-- on adult content doesn't also surface a dedicated adult section unasked.
-- Only meaningful when setting_display_adult_content is also true (the tab is
-- hidden and /adult redirects home otherwise, regardless of this column).
ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS setting_show_adult_tab BOOLEAN NOT NULL DEFAULT false;
