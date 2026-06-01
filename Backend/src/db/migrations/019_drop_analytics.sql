-- Drop the custom Supabase analytics tables and RPC functions.
-- Client and admin analytics have been removed from the app; nothing writes here anymore.

DROP FUNCTION IF EXISTS public.track_presence();
DROP FUNCTION IF EXISTS public.track_page_view(TEXT);
DROP FUNCTION IF EXISTS public.track_content_click(TEXT, INT, INT[], TEXT);

DROP TABLE IF EXISTS public.analytics_tracking_exclusions;
DROP TABLE IF EXISTS public.analytics_genre_clicks;
DROP TABLE IF EXISTS public.analytics_content_clicks;
DROP TABLE IF EXISTS public.analytics_page_views;
DROP TABLE IF EXISTS public.analytics_presence_hours;
