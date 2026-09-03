-- 029_tmdb_ids.sql — Phase 2 of the TMDB-live migration (additive only).
--
-- Adds tmdb_id-based columns to every user table that currently FKs a mirrored
-- content table, and backfills them from the still-present content tables. Nothing
-- is dropped: old columns, old CHECK constraints, old partial-unique indexes and old
-- function signatures all keep working, so the currently-deployed frontend is
-- unaffected and the new frontend can be built against these columns.
--
-- 030 swaps the semantics-changing functions at cutover; 031 drops the old columns
-- and the content tables after a soak.

BEGIN;

-- ---------------------------------------------------------------------------
-- user_rating
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_rating
  ADD COLUMN media_type      text,
  ADD COLUMN tmdb_id         bigint,
  ADD COLUMN tmdb_show_id    bigint,   -- for season/episode ratings (TMDB addresses them by show + numbers)
  ADD COLUMN season_number   int,
  ADD COLUMN episode_number  int;

UPDATE public.user_rating r
  SET media_type = 'movie', tmdb_id = m.tmdb_id
  FROM public.movie m
  WHERE r.movie_id = m.id;

UPDATE public.user_rating r
  SET media_type = 'show', tmdb_id = s.tmdb_id, tmdb_show_id = s.tmdb_id
  FROM public.show s
  WHERE r.show_id = s.id;

UPDATE public.user_rating r
  SET media_type = 'season', tmdb_id = se.tmdb_id, tmdb_show_id = s.tmdb_id,
      season_number = se.season_number
  FROM public.season se
  JOIN public.show s ON s.id = se.show_id
  WHERE r.season_id = se.id;

UPDATE public.user_rating r
  SET media_type = 'episode', tmdb_id = e.tmdb_id, tmdb_show_id = s.tmdb_id,
      season_number = se.season_number, episode_number = e.episode_number
  FROM public.episode e
  JOIN public.season se ON se.id = e.season_id
  JOIN public.show s ON s.id = se.show_id
  WHERE r.episode_id = e.id;

-- Plain (not partial) unique index so PostgREST `onConflict=profile_id,media_type,tmdb_id`
-- works now and after 031. NULLs are DISTINCT by default, so rows an old client writes
-- during the cutover window (media_type/tmdb_id NULL) do not collide.
CREATE UNIQUE INDEX user_rating_profile_media_uniq
  ON public.user_rating (profile_id, media_type, tmdb_id);
CREATE INDEX user_rating_media_idx
  ON public.user_rating (media_type, tmdb_id);

-- ---------------------------------------------------------------------------
-- watchlist_item  (media_type column already exists)
-- ---------------------------------------------------------------------------
ALTER TABLE public.watchlist_item ADD COLUMN tmdb_id bigint;

UPDATE public.watchlist_item wi SET tmdb_id = m.tmdb_id
  FROM public.movie m WHERE wi.movie_id = m.id;
UPDATE public.watchlist_item wi SET tmdb_id = s.tmdb_id
  FROM public.show s WHERE wi.show_id = s.id;

CREATE UNIQUE INDEX watchlist_item_media_uniq
  ON public.watchlist_item (watchlist_id, media_type, tmdb_id);

-- ---------------------------------------------------------------------------
-- profile_favourite
-- ---------------------------------------------------------------------------
ALTER TABLE public.profile_favourite
  ADD COLUMN media_type text,
  ADD COLUMN tmdb_id    bigint;

UPDATE public.profile_favourite pf SET media_type = 'movie', tmdb_id = m.tmdb_id
  FROM public.movie m WHERE pf.movie_id = m.id;
UPDATE public.profile_favourite pf SET media_type = 'show', tmdb_id = s.tmdb_id
  FROM public.show s WHERE pf.show_id = s.id;

-- ---------------------------------------------------------------------------
-- user_followed_movies / user_followed_shows
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_followed_movies
  ADD COLUMN tmdb_id bigint,
  ALTER COLUMN movie_id DROP NOT NULL;
UPDATE public.user_followed_movies ufm SET tmdb_id = m.tmdb_id
  FROM public.movie m WHERE ufm.movie_id = m.id;
CREATE UNIQUE INDEX user_followed_movies_profile_tmdb_uniq
  ON public.user_followed_movies (profile_id, tmdb_id);

ALTER TABLE public.user_followed_shows
  ADD COLUMN tmdb_id bigint,
  ALTER COLUMN show_id DROP NOT NULL;
UPDATE public.user_followed_shows ufs SET tmdb_id = s.tmdb_id
  FROM public.show s WHERE ufs.show_id = s.id;
CREATE UNIQUE INDEX user_followed_shows_profile_tmdb_uniq
  ON public.user_followed_shows (profile_id, tmdb_id);

-- ---------------------------------------------------------------------------
-- get_activity_feed: add a 2-arg overload with no content joins. The existing
-- 3-arg (int,int,bool) version keeps working until 031 (content tables present).
-- The new frontend calls this one; adult filtering moves client-side (card.adult).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_activity_feed(p_limit int DEFAULT 30, p_offset int DEFAULT 0)
RETURNS TABLE (
  rating_id      bigint,
  profile_id     uuid,
  username       text,
  value          smallint,
  rated_at       timestamptz,
  media_type     text,
  tmdb_id        bigint,
  tmdb_show_id   bigint,
  season_number  int,
  episode_number int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    r.id, r.profile_id, pr.username, r.value, r.created_at,
    r.media_type, r.tmdb_id, r.tmdb_show_id, r.season_number, r.episode_number
  FROM public.user_observe o
  JOIN public.profile pr ON pr.id = o.observed_id
  JOIN public.user_rating r ON r.profile_id = o.observed_id
  WHERE o.observer_id = auth.uid()
    AND o.status = 'accepted'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_block b
      WHERE (b.blocker_id = pr.id AND b.blocked_id = auth.uid())
         OR (b.blocker_id = auth.uid() AND b.blocked_id = pr.id)
    )
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT LEAST(COALESCE(p_limit, 30), 60)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.get_activity_feed(int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_activity_feed(int, int) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Stale pg_cron job left over from the removed analytics feature (targets tables
-- dropped in migration 019). Unschedule it.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-analytics');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMIT;

-- Post-checks (run manually, all must be 0):
--   SELECT count(*) FROM public.user_rating       WHERE tmdb_id IS NULL;
--   SELECT count(*) FROM public.watchlist_item    WHERE tmdb_id IS NULL;
--   SELECT count(*) FROM public.profile_favourite WHERE tmdb_id IS NULL;
--   SELECT count(*) FROM public.user_followed_movies WHERE tmdb_id IS NULL;
--   SELECT count(*) FROM public.user_followed_shows  WHERE tmdb_id IS NULL;
