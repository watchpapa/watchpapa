# Scripts to Run

## Commands

- `npm run seed:tmdb:jobs`
- `npm run seed:tmdb:genres`
- `npm run seed:tmdb:person -- --id=<tmdb_person_id>`

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

## TMDB single-person ingestion

Command:

`npm run seed:tmdb:person -- --id=<tmdb_person_id>`

Description:

Fetches a single TMDB person and upserts the row into `public.person` via `INSERT ... ON CONFLICT (tmdb_id) DO UPDATE` with an `IS DISTINCT FROM` change-guard, so `updated_at` only moves when a tracked field actually changes. The result is classified as `inserted`, `updated`, or `unchanged`.

Also diff-syncs `also_known_as` into `public.person_aka`:

- new nicknames are inserted,
- previously soft-deleted matches are restored (`deleted_at = NULL`),
- live rows that TMDB no longer returns are soft-deleted (`deleted_at = now()`).

`known_for_department` is stored directly as the TMDB text value (e.g. `"Acting"`), with no lookup/mapping against the `department` table.

The ingestion runs inside a single transaction (all-or-nothing) and is idempotent — safe to rerun.

The script also exports a reusable function `ingestPerson({ tmdbId, transaction, apiKey })` for use by other scripts (e.g. show/cast ingestion, future bulk popular-people loader). When called with an existing `transaction`, the caller owns commit/rollback.
