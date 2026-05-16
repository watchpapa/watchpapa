-- Analytics tracking tables and RPC functions.
-- All tables have RLS enabled with no user-facing policies — writes go through
-- SECURITY DEFINER functions only. Admin reads go through the Express backend.

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- Hourly presence buckets.
-- One row per (user, UTC hour) — PRIMARY KEY deduplicates via ON CONFLICT DO NOTHING.
-- Used to compute DAU/WAU/MAU and popular day-of-week / hour-of-day heatmaps.
CREATE TABLE public.analytics_presence_hours (
  profile_id  UUID        NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  hour_bucket TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (profile_id, hour_bucket)
);
ALTER TABLE public.analytics_presence_hours ENABLE ROW LEVEL SECURITY;
CREATE INDEX analytics_presence_hours_bucket_idx ON public.analytics_presence_hours(hour_bucket);

-- Page views with pathname only.
-- Sessions are assembled at query time using a 30-minute idle gap heuristic.
-- NULL profile_id = anon visitor. Admins (role=4) excluded at query time.
CREATE TABLE public.analytics_page_views (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id UUID        REFERENCES public.profile(id) ON DELETE SET NULL,
  page       TEXT        NOT NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.analytics_page_views ENABLE ROW LEVEL SECURITY;
CREATE INDEX analytics_page_views_visited_at_idx ON public.analytics_page_views(visited_at DESC);
CREATE INDEX analytics_page_views_profile_idx    ON public.analytics_page_views(profile_id, visited_at DESC);

-- Content (movie / show) click events.
-- 7-day rolling window maintained by daily cron cleanup.
-- source: where the click originated (browse / search / calendar / detail).
CREATE TABLE public.analytics_content_clicks (
  id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id   UUID        REFERENCES public.profile(id) ON DELETE SET NULL,
  content_type TEXT        NOT NULL CHECK (content_type IN ('movie', 'show')),
  content_id   INT         NOT NULL,
  source       TEXT        CHECK (source IN ('browse', 'search', 'calendar', 'detail')),
  clicked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.analytics_content_clicks ENABLE ROW LEVEL SECURITY;
CREATE INDEX analytics_content_clicks_clicked_at_idx ON public.analytics_content_clicks(clicked_at DESC);
CREATE INDEX analytics_content_clicks_content_idx    ON public.analytics_content_clicks(content_type, content_id, clicked_at DESC);
CREATE INDEX analytics_content_clicks_profile_idx    ON public.analytics_content_clicks(profile_id, clicked_at DESC);
CREATE INDEX analytics_content_clicks_source_idx     ON public.analytics_content_clicks(source, clicked_at DESC);

-- Genre click events (fired alongside content clicks, one row per genre per click).
-- 7-day rolling window maintained by daily cron cleanup.
CREATE TABLE public.analytics_genre_clicks (
  id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id   UUID        REFERENCES public.profile(id) ON DELETE SET NULL,
  genre_id     INT         NOT NULL REFERENCES public.genres(id) ON DELETE CASCADE,
  content_type TEXT        NOT NULL CHECK (content_type IN ('movie', 'show')),
  clicked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.analytics_genre_clicks ENABLE ROW LEVEL SECURITY;
CREATE INDEX analytics_genre_clicks_clicked_at_idx    ON public.analytics_genre_clicks(clicked_at DESC);
CREATE INDEX analytics_genre_clicks_profile_genre_idx ON public.analytics_genre_clicks(profile_id, genre_id);

-- Users excluded from page-view tracking (e.g. test accounts).
-- Admins are auto-excluded at query time via role=4 check; this covers others.
CREATE TABLE public.analytics_tracking_exclusions (
  profile_id  UUID        PRIMARY KEY REFERENCES public.profile(id) ON DELETE CASCADE,
  excluded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  excluded_by UUID        REFERENCES public.profile(id),
  note        TEXT
);
ALTER TABLE public.analytics_tracking_exclusions ENABLE ROW LEVEL SECURITY;

-- ─── RPC functions ───────────────────────────────────────────────────────────

-- track_presence()
-- Records one row per (user, UTC hour). Idempotent — safe to call on every load.
CREATE OR REPLACE FUNCTION public.track_presence()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.analytics_presence_hours (profile_id, hour_bucket)
  VALUES (auth.uid(), date_trunc('hour', now() AT TIME ZONE 'UTC'))
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.track_presence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_presence() TO authenticated;

-- track_page_view(p_page TEXT)
-- Records a page visit. Skips excluded users. Accepts anon (NULL uid).
CREATE OR REPLACE FUNCTION public.track_page_view(p_page TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_page IS NULL OR length(trim(p_page)) = 0 OR length(p_page) > 200 THEN
    RETURN;
  END IF;
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.analytics_tracking_exclusions WHERE profile_id = auth.uid()
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.analytics_page_views (profile_id, page, visited_at)
  VALUES (auth.uid(), p_page, now());
END;
$$;
REVOKE ALL ON FUNCTION public.track_page_view(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_page_view(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_page_view(TEXT) TO anon;

-- track_content_click(p_content_type, p_content_id, p_genre_ids, p_source)
-- Records one content-click row and one genre-click row per genre id in the array.
-- Accepts anon (NULL uid). p_source values: browse | search | calendar | detail.
CREATE OR REPLACE FUNCTION public.track_content_click(
  p_content_type TEXT,
  p_content_id   INT,
  p_genre_ids    INT[],
  p_source       TEXT DEFAULT 'browse'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_genre_id INT;
  v_source   TEXT;
BEGIN
  IF p_content_type NOT IN ('movie', 'show') THEN RETURN; END IF;
  IF p_content_id IS NULL OR p_content_id < 1 THEN RETURN; END IF;

  v_source := CASE WHEN p_source IN ('browse', 'search', 'calendar', 'detail') THEN p_source ELSE 'browse' END;

  INSERT INTO public.analytics_content_clicks (profile_id, content_type, content_id, source, clicked_at)
  VALUES (auth.uid(), p_content_type, p_content_id, v_source, now());

  IF p_genre_ids IS NOT NULL THEN
    FOREACH v_genre_id IN ARRAY p_genre_ids LOOP
      BEGIN
        INSERT INTO public.analytics_genre_clicks (profile_id, genre_id, content_type, clicked_at)
        VALUES (auth.uid(), v_genre_id, p_content_type, now());
      EXCEPTION WHEN foreign_key_violation THEN
        -- Silently skip unknown genre ids to avoid surfacing DB errors to the client.
      END;
    END LOOP;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.track_content_click(TEXT, INT, INT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_content_click(TEXT, INT, INT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_content_click(TEXT, INT, INT[], TEXT) TO anon;

-- ─── Retention cleanup ───────────────────────────────────────────────────────
-- To enable automatic cleanup, first turn on pg_cron in Supabase:
--   Dashboard → Database → Extensions → pg_cron → Enable
-- Then run this block once manually:
--
-- SELECT cron.schedule(
--   'cleanup-analytics',
--   '0 3 * * *',
--   $$
--     DELETE FROM public.analytics_content_clicks WHERE clicked_at  < now() - INTERVAL '7 days';
--     DELETE FROM public.analytics_genre_clicks    WHERE clicked_at  < now() - INTERVAL '7 days';
--     DELETE FROM public.analytics_page_views      WHERE visited_at  < now() - INTERVAL '90 days';
--     DELETE FROM public.analytics_presence_hours  WHERE hour_bucket < now() - INTERVAL '90 days';
--   $$
-- );
