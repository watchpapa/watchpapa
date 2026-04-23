# Scripts to Run

## Commands

- `npm run seed:tmdb:jobs`
- `npm run seed:tmdb:genres`
- `npm run seed:tmdb:person -- --id=<tmdb_person_id>`
- `npm run seed:tmdb:tv-show -- --id=<tmdb_tv_id>`
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

`npm run seed:tmdb:tv-show -- --id=<tmdb_tv_id>`

Prerequisites:

- `npm run seed:tmdb:jobs` (department/job rows — required so credits can resolve `job.id` for `"Actor"` and crew jobs).
- `npm run seed:tmdb:genres` (required so `show_genre` can resolve `genres.id` from TMDB genre ids on the show detail payload).

Scope:

Current implementation ingests:

- **Phase 1:** TV show details + show-level credits.
- **Phase 1:** TV show details + `show_genre` + show-level credits.
- **Phase 2:** season rows in `public.season` for regular seasons only (`season_number > 0`).
- **Phase 3:** episode rows in `public.episode` and episode-level credits in `public.episode_credits` for regular seasons.

Special seasons (`season_number <= 0`, usually season 0) are intentionally skipped. `show_genre` is still deferred.

Description:

Fetches one TV series from TMDB (`GET /tv/{id}`) and upserts the row into `public.show` via `INSERT ... ON CONFLICT (tmdb_id) DO UPDATE` with an `IS DISTINCT FROM` change-guard, so `updated_at` only moves when a tracked field actually changes. The result is classified as `inserted`, `updated`, or `unchanged`.

Also replaces genre associations in `public.show_genre`: existing rows for the show are deleted and re-inserted from the TV detail `genres[]` array. Each TMDB genre id is resolved through `genres.tmdb_id`; missing mappings are skipped with a warning.

Fetches credits from `GET /tv/{id}/credits` and fully replaces `public.show_credits` for the show:

- Existing rows for the show are deleted, then every `cast` and `crew` entry is re-inserted (`guest_stars` are ignored — those belong at the episode level, which is not in scope yet).
- For each distinct credited person, `ingestPerson` (from `inject_person.js`) is invoked on the same transaction, so new people are upserted into `public.person` (with AKAs synced) before their credit row is written.
- Cast entries are linked to the job `"Actor"` in department `"Acting"`, with `title` set to the `character` string.
- Crew entries are linked to the job matching `crew.job` in department `crew.department`, with `title = null` (the role is encoded in `job_id`).
- Duplicate TMDB entries (same person + role) are deduped before insert.
- Any credit whose `(job, department)` is not found in the local `job` table is skipped with a warning; run `seed:tmdb:jobs` first to populate it.

After Phase 1 commits, the script runs Phase 2 season sync:

- Reads `seasons[]` from the TV detail payload and keeps only regular seasons (`season_number > 0`).
- Dedupes by `season_number`, sorts ascending, then fetches each season detail from `GET /tv/{id}/season/{season_number}`.
- Upserts each season into `public.season` (`ON CONFLICT (tmdb_id)`), tracking `inserted`, `updated`, and `unchanged`.
- Special seasons (`season_number <= 0`) are counted and skipped.

After Phase 2 commits, the script runs Phase 3 episode sync:

- For each regular season, reads season episode numbers and fetches episode detail from `GET /tv/{id}/season/{season_number}/episode/{episode_number}`.
- Upserts each episode into `public.episode` (`id` and `tmdb_id` both use TMDB episode id), tracking `inserted`, `updated`, and `unchanged`.
- Fetches episode credits from `GET /tv/{id}/season/{season_number}/episode/{episode_number}/credits`.
- Merges cast + crew + guest stars from episode detail and episode-credits payloads, dedupes, and fully replaces `public.episode_credits` per episode.
- Cast and guest stars are mapped to job `"Actor"` in department `"Acting"`; crew uses TMDB `job` + `department`.
- Missing job mappings are skipped with warnings (requires `seed:tmdb:jobs`).

Transactions:

- One transaction for the **show details** upsert.
- One transaction for the **credits** replace (delete-then-bulk-insert, with person upserts).
- One transaction for the **seasons** phase (upsert regular seasons only).
- One transaction per **episode** in the episodes phase (episode upsert + episode_credits replace for that single episode).

Failures in later phases can leave earlier committed phases in place (details -> credits -> seasons). In Phase 3, failed episodes are rolled back individually while successful episodes remain committed. Rerunning the same `--id` is idempotent.

While the script runs, terminal progress bars show show-credit person prefetch and live episode progress (`processed/total` with current `SxEy`) during Phase 3, then the final summary.

The script exports `ingestTvShow({ tmdbTvId, apiKey, onPrefetchProgress, onEpisodeProgress })` for reuse; the CLI entrypoint writes `script_logs` on success or failure (with per-phase rows for `inject_tv_show:details`, `inject_tv_show:credits`, `inject_tv_show:seasons`, and `inject_tv_show:episodes`).

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
