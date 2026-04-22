# Scripts to Run

## Commands

- `npm run seed:tmdb:jobs`
- `npm run seed:tmdb:genres`

## TMDB jobs and departments ingestion

Command:

`npm run seed:tmdb:jobs`

Description:

Fetches TMDB job configuration data and inserts normalized records into `department` and `job` tables in Supabase/Postgres. The ingestion is transactional (all-or-nothing) and safe to rerun because existing records are skipped.

## TMDB genres ingestion

Command:

`npm run seed:tmdb:genres`

Description:

Fetches TMDB movie and TV genre lists and upserts them into the shared `public.genres` table, deduped by `tmdb_id`. New genres are inserted, and existing rows are updated only when their name has changed. The ingestion is transactional (all-or-nothing) and safe to rerun.
