# Scripts to Run

## Commands

- `npm run seed:tmdb:jobs`
- `npm run seed:tmdb:genres`
- `npm run seed:tmdb:person -- --id=<tmdb_person_id>`
- `npm run seed:tmdb:tv-show -- --id=<tmdb_tv_id> [--txn-scope=season|episode] [--include-specials]`
- `npm run seed:tmdb:movie -- --id=<tmdb_movie_id>`

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

`known_for_department_id` is resolved by looking up the TMDB `known_for_department` text value (e.g. `"Acting"`) against `department.name` and storing the resulting `department.id` (nullable `bigint`). Resolutions are memoized for the lifetime of the process. Requires `seed:tmdb:jobs` to have been run first so the `department` rows exist.

The ingestion runs inside a single transaction (all-or-nothing) and is idempotent — safe to rerun.

The script also exports a reusable function `ingestPerson({ tmdbId, transaction, apiKey })` for use by other scripts (e.g. show/cast ingestion, future bulk popular-people loader). When called with an existing `transaction`, the caller owns commit/rollback.

## TMDB single TV show ingestion

Command:

`npm run seed:tmdb:tv-show -- --id=<tmdb_tv_id> [--txn-scope=season|episode] [--include-specials]`

Prerequisites:

- `npm run seed:tmdb:jobs` (department/job rows for crew resolution).
- `npm run seed:tmdb:genres` (required so `show_genre` can resolve `genres.id` from TMDB genre ids on the TV detail payload).

Description:

Fetches one TV series from TMDB and upserts `show` (`ON CONFLICT (tmdb_id)`), replaces `show_genre`, replaces `show_credits` from **`GET /tv/{id}/credits`** using **`cast` and `crew` only** (not `guest_stars`; episode-level guests stay in `episode_credits` only), with `ingestPerson` per credited person. Then for each **regular** season from the TV detail `seasons` list (by default **skips `season_number <= 0`**, e.g. TMDB “Specials”), it loads season JSON and upserts `season` and every `episode` (`id` / `tmdb_id` = TMDB episode id, `ON CONFLICT (tmdb_id)`). For each episode it merges cast/crew/guest data from the episode detail endpoint and `.../episode/{n}/credits`, runs `ingestPerson` for each distinct person, and replaces `episode_credits` for that episode.

Use **`--include-specials`** to ingest TMDB specials / non-positive `season_number` seasons as well.

Transactions:

- One transaction for the **show slice** (`show` + `show_genre` + `show_credits`).
- **`--txn-scope=season`** (default): one transaction per season (all episodes in that season in the same commit).
- **`--txn-scope=episode`**: one transaction per episode (season row is upserted inside each episode transaction).

Failures partway through leave earlier commits in place; rerunning the same `--id` is idempotent.

While the script runs, a **terminal progress bar** shows completion of the show slice (show + genres + aggregate credits) plus one step per **regular season** ingested (`show + seasons` counter).

Optional composite uniqueness ideas for `season` / `episode` (beyond TMDB `tmdb_id` uniques) are noted in [Documentation/TODO.md](./TODO.md).

The script exports `ingestTvShow({ tmdbTvId, apiKey, txnScope, includeSpecials })` for reuse; the CLI entrypoint writes `script_logs` on success or failure.

## TMDB single movie ingestion

Command:

`npm run seed:tmdb:movie -- --id=<tmdb_movie_id>`

Prerequisites:

- `npm run seed:tmdb:jobs` (department/job rows — required so credits can resolve `job.id` for `"Actor"` and crew jobs).
- `npm run seed:tmdb:genres` (required so `movie_genre` can resolve `genres.id` from TMDB genre ids on the movie detail payload).

Description:

Fetches one movie from TMDB (`GET /movie/{id}`) and upserts the row into `public.movie` via `INSERT ... ON CONFLICT (tmdb_id) DO UPDATE` with an `IS DISTINCT FROM` change-guard, so `updated_at` only moves when a tracked field actually changes. The result is classified as `inserted`, `updated`, or `unchanged`.

Replaces genre associations in `public.movie_genre`: existing rows for the movie are deleted and re-inserted from the `genres[]` array on the TMDB payload. Each TMDB genre `id` is looked up in `genres.tmdb_id`; any genre not found in the local table is skipped with a warning (run `seed:tmdb:genres` first to populate it).

Fetches credits from `GET /movie/{id}/credits` and fully replaces `public.movie_credits` for the movie:

- Existing rows for the movie are deleted, then every `cast` and `crew` entry is re-inserted.
- For each distinct credited person, `ingestPerson` (from `inject_person.js`) is invoked on the same transaction, so new people are upserted into `public.person` (with AKAs synced) before their credit row is written.
- Cast entries are linked to the job `"Actor"` in department `"Acting"`, with `title` set to the `character` string.
- Crew entries are linked to the job matching `crew.job` in department `crew.department`, with `title = null` (the role is encoded in `job_id`).
- Duplicate TMDB entries (same person + role) are deduped before insert.
- Any credit whose `(job, department)` is not found in the local `job` table is skipped with a warning; run `seed:tmdb:jobs` first to populate it.

Everything (movie upsert, genre replace, person upserts, credits replace) runs inside a single transaction (all-or-nothing) and is idempotent — safe to rerun.

The script exports a reusable function `ingestMovie({ tmdbId, transaction, apiKey, onCreditsProgress })` for use by other scripts (e.g. future bulk movie loaders). When called with an existing `transaction`, the caller owns commit/rollback.
