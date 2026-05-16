-- Rollback for 013_analytics.sql.
-- Safe to run at any time — only drops objects created by that migration.
-- No existing tables or columns are touched.

-- Only run this line if you previously enabled pg_cron and registered the job:
-- SELECT cron.unschedule('cleanup-analytics');

DROP TABLE IF EXISTS public.analytics_tracking_exclusions;
DROP TABLE IF EXISTS public.analytics_genre_clicks;
DROP TABLE IF EXISTS public.analytics_content_clicks;
DROP TABLE IF EXISTS public.analytics_page_views;
DROP TABLE IF EXISTS public.analytics_presence_hours;

DROP FUNCTION IF EXISTS public.track_presence();
DROP FUNCTION IF EXISTS public.track_page_view(TEXT);
DROP FUNCTION IF EXISTS public.track_content_click(TEXT, INT, INT[], TEXT);
