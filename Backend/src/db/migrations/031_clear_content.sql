-- 031_clear_content.sql — Phase 5, after a clean soak.
--
-- Locks in the new user-table shape and CLEARS (but keeps) the 15 mirrored TMDB
-- content tables so the ~1.3 GB is reclaimed while the empty schema — tables,
-- indexes, RLS policies, tmdb_id constraints — stays as scaffolding.
--
-- NOTE: for the tables to STAY empty, the GitHub sync workflows (daily-sync,
-- weekly-sync, full-sync, seed-one-off) must be disabled — they re-ingest into
-- these tables every night. Nothing reads them any more.
--
-- Dropping the OLD id COLUMNS from the user tables is still required: their FK
-- constraints (user_rating.movie_id -> movie.id, etc.) block a plain TRUNCATE.

-- 1. Idempotent re-backfill for any rows a stale client wrote during the cutover.
UPDATE public.user_rating r SET media_type = 'movie', tmdb_id = m.tmdb_id
  FROM public.movie m WHERE r.tmdb_id IS NULL AND r.movie_id = m.id;
UPDATE public.user_rating r SET media_type = 'show', tmdb_id = s.tmdb_id, tmdb_show_id = s.tmdb_id
  FROM public.show s WHERE r.tmdb_id IS NULL AND r.show_id = s.id;
UPDATE public.user_rating r SET media_type = 'season', tmdb_id = se.tmdb_id, tmdb_show_id = s.tmdb_id, season_number = se.season_number
  FROM public.season se JOIN public.show s ON s.id = se.show_id
  WHERE r.tmdb_id IS NULL AND r.season_id = se.id;
UPDATE public.user_rating r SET media_type = 'episode', tmdb_id = e.tmdb_id, tmdb_show_id = s.tmdb_id, season_number = se.season_number, episode_number = e.episode_number
  FROM public.episode e JOIN public.season se ON se.id = e.season_id JOIN public.show s ON s.id = se.show_id
  WHERE r.tmdb_id IS NULL AND r.episode_id = e.id;
UPDATE public.watchlist_item wi SET tmdb_id = m.tmdb_id FROM public.movie m WHERE wi.tmdb_id IS NULL AND wi.movie_id = m.id;
UPDATE public.watchlist_item wi SET tmdb_id = s.tmdb_id FROM public.show s  WHERE wi.tmdb_id IS NULL AND wi.show_id = s.id;
UPDATE public.profile_favourite pf SET media_type = 'movie', tmdb_id = m.tmdb_id FROM public.movie m WHERE pf.tmdb_id IS NULL AND pf.movie_id = m.id;
UPDATE public.profile_favourite pf SET media_type = 'show', tmdb_id = s.tmdb_id  FROM public.show s  WHERE pf.tmdb_id IS NULL AND pf.show_id = s.id;
UPDATE public.user_followed_movies ufm SET tmdb_id = m.tmdb_id FROM public.movie m WHERE ufm.tmdb_id IS NULL AND ufm.movie_id = m.id;
UPDATE public.user_followed_shows  ufs SET tmdb_id = s.tmdb_id FROM public.show s  WHERE ufs.tmdb_id IS NULL AND ufs.show_id = s.id;

-- 2. Delete rows that can never be mapped (content row was already gone). Review
--    the counts before running if non-zero.
DELETE FROM public.user_rating       WHERE tmdb_id IS NULL;
DELETE FROM public.watchlist_item    WHERE tmdb_id IS NULL;
DELETE FROM public.profile_favourite WHERE tmdb_id IS NULL;
DELETE FROM public.user_followed_movies WHERE tmdb_id IS NULL;
DELETE FROM public.user_followed_shows  WHERE tmdb_id IS NULL;

-- 3. Lock in the new shape; drop the old id columns (removes the FKs + old partial
--    unique indexes with them).
ALTER TABLE public.user_rating
  ALTER COLUMN media_type SET NOT NULL,
  ALTER COLUMN tmdb_id SET NOT NULL,
  ADD CONSTRAINT user_rating_media_type_check CHECK (media_type IN ('movie','show','season','episode')),
  ADD CONSTRAINT user_rating_parent_check CHECK (
    (media_type IN ('movie','show') AND season_number IS NULL AND episode_number IS NULL)
    OR (media_type = 'season'  AND tmdb_show_id IS NOT NULL AND season_number IS NOT NULL AND episode_number IS NULL)
    OR (media_type = 'episode' AND tmdb_show_id IS NOT NULL AND season_number IS NOT NULL AND episode_number IS NOT NULL)
  ),
  DROP COLUMN movie_id,
  DROP COLUMN show_id,
  DROP COLUMN season_id,
  DROP COLUMN episode_id;

ALTER TABLE public.watchlist_item
  ALTER COLUMN tmdb_id SET NOT NULL,
  DROP COLUMN movie_id,
  DROP COLUMN show_id;

ALTER TABLE public.profile_favourite
  ALTER COLUMN media_type SET NOT NULL,
  ALTER COLUMN tmdb_id SET NOT NULL,
  ADD CONSTRAINT profile_favourite_media_type_check CHECK (media_type IN ('movie','show')),
  DROP COLUMN movie_id,
  DROP COLUMN show_id;

ALTER TABLE public.user_followed_movies ALTER COLUMN tmdb_id SET NOT NULL, DROP COLUMN movie_id;
ALTER TABLE public.user_followed_shows  ALTER COLUMN tmdb_id SET NOT NULL, DROP COLUMN show_id;

-- 4. Drop functions that only made sense with the mirror; promote _v2.
DROP FUNCTION IF EXISTS public.get_activity_feed(integer, integer, boolean);
DROP FUNCTION IF EXISTS public.get_profile_genre_stats(uuid);
ALTER FUNCTION public.get_activity_feed_v2(integer, integer) RENAME TO get_activity_feed;

-- 5. Clear the mirror. Tables, indexes, RLS policies and tmdb_id constraints all
--    stay; only the rows go. CASCADE handles the FKs *among* these 15 tables
--    (nothing outside the set references them any more, post step 3).
TRUNCATE
  public.episode_credits,
  public.show_credits,
  public.movie_credits,
  public.movie_genre,
  public.show_genre,
  public.person_aka,
  public.episode,
  public.season,
  public.movie,
  public.show,
  public.person,
  public.job,
  public.department,
  public.genres,
  public.script_logs
CASCADE;

-- Post-checks:
--   SELECT pg_size_pretty(pg_database_size(current_database()));  -- expect ~1.3 GB smaller
--   SELECT count(*) FROM public.movie;  -- 0
--   \d public.user_rating   -- no movie_id/show_id/season_id/episode_id
