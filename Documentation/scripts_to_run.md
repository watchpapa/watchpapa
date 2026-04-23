# Scripts to Run

## Commands

- `npm run seed:tmdb:jobs`
- `npm run seed:tmdb:genres`
- `npm run seed:tmdb:person -- --id=<tmdb_person_id>`
- `npm run seed:tmdb:tv-show -- --id=<tmdb_tv_id>`
- `npm run seed:tmdb:movie -- --id=<tmdb_movie_id>`
- `npm run seed:tmdb:popular-movies-today -- --limit=<count>`
- `npm run seed:tmdb:popular-people-today -- --limit=<count>`
- `npm run seed:tmdb:popular-shows-today -- --limit=<count>`
- `npm run seed:tmdb:top-rated-movies -- --limit=<count>`
- `npm run seed:tmdb:top-rated-shows -- --limit=<count>`

## Injection script tests

Command:

`npm run test:injections`

Description:

Runs Node-based tests under `tests/injections_tests` for all `inject_*.js` scripts. Coverage focuses on:

- CLI guardrails (`--id` and `--limit` validation).
- Environment guards (missing `TMDB_API_KEY_SECRET`).
- Exported ingestion function guards (invalid ids, required api key checks).
- Fast-path skip behavior when records already exist (mocked `sequelize.query`).

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

Checks `public.person` by `tmdb_id` first. If the person already exists, the script skips without updating person fields or AKAs. If missing, it fetches TMDB person details and inserts a new row into `public.person`.

For newly inserted people only, it inserts `also_known_as` values into `public.person_aka`.

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

Checks `public.show` by `tmdb_id` first. If the show already exists, the script skips immediately (no details refresh, no genres refresh, no credits/seasons/episodes work). If missing, it fetches TMDB data and inserts a new show.

For newly inserted shows, genre associations are inserted into `public.show_genre` from the TV detail `genres[]` array. Each TMDB genre id is resolved through `genres.tmdb_id`; missing mappings are skipped with a warning.

For newly inserted shows, it fetches credits from `GET /tv/{id}/credits` and inserts `public.show_credits` rows:

- For each distinct credited person, `ingestPerson` (from `inject_person.js`) is invoked on the same transaction; existing people are skipped, missing people are inserted before their credit row is written.
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

- One transaction for the **show details** insert.
- One transaction for the **credits** insert phase.
- One transaction for the **seasons** phase.
- One transaction per **episode** in the episodes phase.

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

Checks `public.movie` by `tmdb_id` first. If the movie already exists, the script skips immediately (no details refresh, no genres refresh, no credits/person work). If missing, it fetches TMDB data and inserts a new movie.

For newly inserted movies, genre associations are inserted into `public.movie_genre` from the `genres[]` array on the TMDB payload. Each TMDB genre `id` is looked up in `genres.tmdb_id`; any genre not found in the local table is skipped with a warning (run `seed:tmdb:genres` first to populate it).

For newly inserted movies, it fetches credits from `GET /movie/{id}/credits` and inserts `public.movie_credits` rows:

- For each distinct credited person, `ingestPerson` (from `inject_person.js`) is invoked on the same transaction; existing people are skipped, missing people are inserted before their credit row is written.
- Cast entries are linked to the job `"Actor"` in department `"Acting"`, with `title` set to the `character` string.
- Crew entries are linked to the job matching `crew.job` in department `crew.department`, with `title = null` (the role is encoded in `job_id`).
- Duplicate TMDB entries (same person + role) are deduped before insert.
- Any credit whose `(job, department)` is not found in the local `job` table is skipped with a warning; run `seed:tmdb:jobs` first to populate it.

Everything for a new movie insert (movie row, genre links, person inserts, credits) runs inside transactions and is idempotent — safe to rerun.

The script exports a reusable function `ingestMovie({ tmdbId, transaction, apiKey, onCreditsProgress })` for use by other scripts (e.g. future bulk movie loaders). When called with an existing `transaction`, the caller owns commit/rollback.

## TMDB popular movies today ingestion

Command:

`npm run seed:tmdb:popular-movies-today -- --limit=<count>`

Description:

Fetches today’s TMDB popular movies from `GET /movie/popular` (paged), takes the first `limit` results (default `20`, max `500`), and checks which `tmdb_id` values already exist in `public.movie`.

Existing movies are skipped, and no connected ingestion work runs for them (no movie details refresh, no genres refresh, no credits/person refresh). Only missing movies run through `ingestMovie`, which inserts the movie with genres and credits/person relationships.

The script writes a top-level `script_logs` row (`inject_popular_movies_today:limit=<count>`) and prints a final summary with requested count, skipped existing count, and inserted count.

## TMDB popular people today ingestion

Command:

`npm run seed:tmdb:popular-people-today -- --limit=<count>`

Description:

Fetches today’s TMDB popular people from `GET /person/popular` (paged), takes the first `limit` results (default `20`, max `500`), and checks which `tmdb_id` values already exist in `public.person`.

Existing people are skipped, and no refresh/update is performed for those rows. Only missing people run through `ingestPerson`, which inserts the person and their AKA values.

The script writes a top-level `script_logs` row (`inject_popular_people_today:limit=<count>`) and prints a final summary with requested count, skipped existing count, skipped race count, and inserted count.

## TMDB popular shows today ingestion

Command:

`npm run seed:tmdb:popular-shows-today -- --limit=<count>`

Description:

Fetches today’s TMDB popular TV shows from `GET /tv/popular` (paged), takes the first `limit` results (default `20`, max `500`), and checks which `tmdb_id` values already exist in `public.show`.

Existing shows are skipped, and no refresh/update is performed for those rows. Only missing shows run through `ingestTvShow`, which inserts the show and runs the same downstream ingestion phases as single-show ingestion.

The script writes a top-level `script_logs` row (`inject_popular_shows_today:limit=<count>`) and prints a final summary with requested count, skipped existing count, skipped race count, and inserted count.

## TMDB top-rated movies ingestion

Command:

`npm run seed:tmdb:top-rated-movies -- --limit=<count>`

Description:

Fetches TMDB top-rated movies from `GET /movie/top_rated` (paged), takes the first `limit` results (default `20`, max `500`), and checks which `tmdb_id` values already exist in `public.movie`.

Existing movies are skipped, and no connected ingestion work runs for them (no movie details refresh, no genres refresh, no credits/person refresh). Only missing movies run through `ingestMovie`, which inserts the movie with genres and credits/person relationships.

The script writes a top-level `script_logs` row (`inject_top_rated_movies:limit=<count>`) and prints a final summary with requested count, skipped existing count, skipped race count, and inserted count.

## TMDB top-rated shows ingestion

Command:

`npm run seed:tmdb:top-rated-shows -- --limit=<count>`

Description:

Fetches TMDB top-rated TV shows from `GET /tv/top_rated` (paged), takes the first `limit` results (default `20`, max `500`), and checks which `tmdb_id` values already exist in `public.show`.

Existing shows are skipped, and no refresh/update is performed for those rows. Only missing shows run through `ingestTvShow`, which inserts the show and runs the same downstream ingestion phases as single-show ingestion.

The script writes a top-level `script_logs` row (`inject_top_rated_shows:limit=<count>`) and prints a final summary with requested count, skipped existing count, skipped race count, and inserted count.
