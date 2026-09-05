-- One-time backfill for two features that shipped after ratings already
-- existed (migrations 038 watch_log, 039 user_rating_history): without this,
-- every pre-existing rating has zero rows in both new tables, which (a) made
-- WatchedPanel permanently unable to show "unwatched" for an already-rated
-- title (fixed on the app side too — count is now authoritative once
-- loaded, never re-seeded), and (b) hid RatingHistoryPanel for a rating
-- changed for the first time after these migrations (its first post-change
-- history row was the only one that existed, one short of the 2-entry
-- threshold that panel requires).
--
-- Movie/show ratings only for watch_log — season/episode ratings don't map
-- to a single "the show is watched" moment retroactively (that requires
-- knowing whether all seasons/episodes were ever rated, not just this one),
-- so those are left to be seeded going forward the normal way.
-- Idempotent: safe to re-run, existing rows are never duplicated.

INSERT INTO public.watch_log (profile_id, media_type, tmdb_id, watched_at, created_at)
SELECT ur.profile_id, ur.media_type, ur.tmdb_id, ur.created_at::date, ur.created_at
FROM public.user_rating ur
WHERE ur.media_type IN ('movie', 'show')
  AND NOT EXISTS (
    SELECT 1 FROM public.watch_log wl
    WHERE wl.profile_id = ur.profile_id AND wl.media_type = ur.media_type AND wl.tmdb_id = ur.tmdb_id
  );

INSERT INTO public.user_rating_history (profile_id, media_type, tmdb_id, value, changed_at)
SELECT ur.profile_id, ur.media_type, ur.tmdb_id, ur.value, ur.created_at
FROM public.user_rating ur
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_rating_history urh
  WHERE urh.profile_id = ur.profile_id AND urh.media_type = ur.media_type AND urh.tmdb_id = ur.tmdb_id
);
