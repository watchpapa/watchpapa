-- 030a_drop_xor_checks.sql — applied 2026-09-03, ahead of the main 030 cutover.
--
-- Drops the exclusive-or CHECK constraints so the TMDB-id frontend can insert
-- rows that set only (media_type, tmdb_id). Safe for the still-live old frontend:
-- it always sets exactly one legacy id column, and that validity no longer needs
-- enforcing. Split out of 030 (whose function-semantics swaps must still wait for
-- the cutover window) so Phase 3 dev testing works.

ALTER TABLE public.user_rating       DROP CONSTRAINT IF EXISTS user_rating_one_media;
ALTER TABLE public.watchlist_item    DROP CONSTRAINT IF EXISTS watchlist_item_one_media;
ALTER TABLE public.profile_favourite DROP CONSTRAINT IF EXISTS profile_favourite_one_media;
