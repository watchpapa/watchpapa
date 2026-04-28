# Scripts to Run

## Database migrations

Run once against the Supabase project (SQL editor or any Postgres client):

```
Backend/migrations/001_perf_indexes.sql
```

Adds: `genres(tmdb_id)` unique index, `person(popularity DESC)` partial index, and GIN trigram indexes on movie/show/person name columns for fast ILIKE search. Requires the `pg_trgm` extension (enabled by the script).

---

## Commands

### TMDB ingestion

#### Reference data (taxonomy)

- `npm run seed:tmdb:jobs`
- `npm run seed:tmdb:genres`

#### Single entity (by TMDB id)

- `npm run seed:tmdb:person -- --id=<tmdb_person_id> [--force]`
- `npm run seed:tmdb:tv-show -- --id=<tmdb_tv_id> [--force]`
- `npm run seed:tmdb:movie -- --id=<tmdb_movie_id> [--force]`

#### Discovery lists (popular and top-rated)

- `npm run seed:tmdb:popular-movies-today -- --limit=<count>`
- `npm run seed:tmdb:popular-people-today -- --limit=<count>`
- `npm run seed:tmdb:popular-shows-today -- --limit=<count>`
- `npm run seed:tmdb:top-rated-movies -- --limit=<count>`
- `npm run seed:tmdb:top-rated-shows -- --limit=<count>`

#### Incremental refresh (TMDB changes)

- `npm run seed:tmdb:changed-movies-24h -- --limit=<count> --start-date=<yyyy-mm-dd> --end-date=<yyyy-mm-dd>`
- `npm run seed:tmdb:changed-shows-24h -- --limit=<count> --start-date=<yyyy-mm-dd> --end-date=<yyyy-mm-dd>`
- `npm run seed:tmdb:changed-people-24h -- --limit=<count> --start-date=<yyyy-mm-dd> --end-date=<yyyy-mm-dd>`
- `npm run seed:tmdb:changed-all-24h -- --limit=<count> --start-date=<yyyy-mm-dd> --end-date=<yyyy-mm-dd>`

### TMDB maintenance

#### Popularity-only refresh (existing rows)

Aggregator (movie + show + person, in that order, when `--entity=all`):

- `npm run seed:tmdb:update-popularity -- --entity=<movie|show|person|all> --page-size=<count> --limit=<count> --fetch-concurrency=<count>`

Entity-specific (no `--entity` flag accepted):

- `npm run seed:tmdb:update-popularity:movies -- --page-size=<count> --limit=<count> --fetch-concurrency=<count>`
- `npm run seed:tmdb:update-popularity:shows -- --page-size=<count> --limit=<count> --fetch-concurrency=<count>`
- `npm run seed:tmdb:update-popularity:people -- --page-size=<count> --limit=<count> --fetch-concurrency=<count>`

### Tests

- `npm run test:injections`
- `npm run test:injections:watch`
- `npm run test:py`

## Injection script tests

Command:

`npm run test:injections`

Description:

Runs Node-based tests under `tests/injections_tests` for all `inject_*.js` scripts. Coverage focuses on:

- CLI guardrails (`--id` and `--limit` validation).
- Environment guards (missing `TMDB_API_KEY_SECRET`).
- Exported ingestion function guards (invalid ids, required api key checks).
- Fast-path skip behavior when records already exist (mocked `sequelize.query`).
- Signal handling: SIGINT/SIGTERM handlers exit non-zero and write exactly one `stopped` message (tested via `signal_test_harness.js`).

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

`npm run seed:tmdb:person -- --id=<tmdb_person_id> [--force]`

Description:

Checks `public.person` by `tmdb_id` first.

- Without `--force`: existing people are skipped.
- With `--force`: existing people are refreshed (person fields are updated and AKAs are synced).
- If missing, the script fetches TMDB person details and inserts a new row into `public.person`.

For inserted or force-refreshed people, `also_known_as` values are synced in `public.person_aka`:

- new AKA values are inserted,
- previously soft-deleted matches are restored,
- stale active AKA values are soft-deleted.

`known_for_department_id` is resolved by looking up the TMDB `known_for_department` text value (e.g. `"Acting"`) against `department.name` and storing the resulting `department.id` (nullable `bigint`). Resolutions are memoized for the lifetime of the process. Requires `seed:tmdb:jobs` to have been run first so the `department` rows exist.

Each person sync runs inside a single transaction (all-or-nothing) and is idempotent — safe to rerun.

The script also exports a reusable function `ingestPerson({ tmdbId, transaction, apiKey, preloadedPayload, forceRefreshExisting, refreshScope })` for use by other scripts (e.g. show/cast ingestion, bulk loaders, and refresh jobs). When called with an existing `transaction`, the caller owns commit/rollback. When `refreshScope` is provided for an existing person under `forceRefreshExisting`, only the truthy phases (`details`, `aka`) run — the person row update is skipped when `details=false` and the AKA sync is skipped when `aka=false`.

## TMDB single TV show ingestion

Command:

`npm run seed:tmdb:tv-show -- --id=<tmdb_tv_id> [--force]`

Prerequisites:

- `npm run seed:tmdb:jobs` (recommended to pre-seed department/job taxonomy; the credits resolver can now create missing department/job rows on demand).
- `npm run seed:tmdb:genres` (required so `show_genre` can resolve `genres.id` from TMDB genre ids on the show detail payload).

Scope:

Current implementation ingests:

- **Phase 1:** TV show details + `show_genre` + show-level credits.
- **Phase 2:** season rows in `public.season` for regular seasons only (`season_number > 0`).
- **Phase 3:** episode rows in `public.episode` and episode-level credits in `public.episode_credits` for regular seasons.

Special seasons (`season_number <= 0`, usually season 0) are intentionally skipped.

Description:

Checks `public.show` by `tmdb_id` first.

- Without `--force`: existing shows are skipped immediately (no details refresh, no genres refresh, no credits/seasons/episodes work).
- With `--force`: existing shows are refreshed (details, `show_genre`, show credits, seasons, episodes, and episode credits are resynced).
- If missing, it fetches TMDB data and inserts a new show.

For inserted or force-refreshed shows, genre associations are synced in `public.show_genre` from the TV detail `genres[]` array. Each TMDB genre id is resolved through `genres.tmdb_id`; missing mappings are skipped with a warning.

For inserted or force-refreshed shows, it fetches credits from `GET /tv/{id}/credits` and syncs `public.show_credits` rows:

- For each distinct credited person, `ingestPerson` (from `inject_person.js`) is invoked on the same transaction; existing people are skipped, missing people are inserted before their credit row is written.
- Cast entries are linked to the job `"Actor"` in department `"Acting"`, with `title` set to the `character` string.
- Crew entries are linked to the job matching `crew.job` in department `crew.department`, with `title = null` (the role is encoded in `job_id`).
- Duplicate TMDB entries (same person + role) are deduped before insert.
- Job resolution is case-insensitive and job-first:
  - It first searches globally by job name (ignoring department and letter case).
  - If exactly one job-name match exists, that job is used even if TMDB department differs.
  - If multiple matches exist (same job name in multiple departments), department is used only to disambiguate (case-insensitive).
  - If no global match exists, the resolver creates/fetches the TMDB department (case-insensitive) and creates the job in that department.
  - If multiple job-name matches exist but none match the TMDB department, the credit is skipped with an ambiguity warning.

After Phase 1 commits, the script runs Phase 2 season sync:

- Reads `seasons[]` from the TV detail payload and keeps only regular seasons (`season_number > 0`).
- Dedupes by `season_number`, sorts ascending, then fetches each season detail from `GET /tv/{id}/season/{season_number}`.
- Upserts each season into `public.season` (`ON CONFLICT (tmdb_id)`), tracking `inserted`, `updated`, and `unchanged`.
- Special seasons (`season_number <= 0`) are counted and skipped.

After Phase 2 commits, the script runs Phase 3 episode sync:

- For each regular season, reads season episode numbers and fetches episode detail from `GET /tv/{id}/season/{season_number}/episode/{episode_number}`.
- Upserts each episode into `public.episode` by `tmdb_id` (`ON CONFLICT (tmdb_id)`), while `id` is the database-generated primary key, tracking `inserted`, `updated`, and `unchanged`.
- This requires `public.episode.id` to be an identity/defaulted bigint in the database schema.
- Fetches episode credits from `GET /tv/{id}/season/{season_number}/episode/{episode_number}/credits`.
- Merges cast + crew + guest stars from episode detail and episode-credits payloads, dedupes, and fully replaces `public.episode_credits` per episode.
- Cast and guest stars are mapped to job `"Actor"` in department `"Acting"`; crew uses TMDB `job` + `department`.
- Episode credit job resolution uses the same case-insensitive, job-first rules as show/movie credits; ambiguous duplicates with no matching department are skipped with warnings.

Transactions:

- Show sync runs inside a single transaction covering details, show genres, show credits, seasons, episodes, and episode credits.
- Any failure rolls back the full show sync for that run.
- Rerunning the same `--id` is idempotent.

While the script runs, terminal progress bars show show-credit person prefetch and live episode progress (`processed/total` with current `SxEy`) during Phase 3, then the final summary.

The script exports `ingestTvShow({ tmdbTvId, apiKey, onPrefetchProgress, onEpisodeProgress, forceRefreshExisting, refreshScope, targetedEpisodes })` for reuse. The `refreshScope` lets callers gate phases (`details`, `genres`, `credits`, `seasons`, `episodes`, `episodeCredits`) and the destructive `DELETE FROM show_credits` / `DELETE FROM episode_credits` queries are gated accordingly — but in practice the change-driven runner only ever passes the targeted-episodes scope (`episodes`/`episodeCredits` only) or `null` (full sync), because cast/crew credits must always travel with their parent entity. When `targetedEpisodes` is provided as a list of `{ seasonNumber, episodeNumber }` (typically derived from `GET /tv/{id}/changes`), only those specific episodes are refreshed (and their per-episode credits are re-injected) instead of the whole show. The CLI entrypoint writes a single top-level `script_logs` row for the run (`inject_tv_show:<tmdbTvId>`) on success or failure.

## TMDB single movie ingestion

Command:

`npm run seed:tmdb:movie -- --id=<tmdb_movie_id> [--force]`

Prerequisites:

- `npm run seed:tmdb:jobs` (recommended to pre-seed department/job taxonomy; the credits resolver can now create missing department/job rows on demand).
- `npm run seed:tmdb:genres` (required so `movie_genre` can resolve `genres.id` from TMDB genre ids on the movie detail payload).

Description:

Checks `public.movie` by `tmdb_id` first.

- Without `--force`: existing movies are skipped immediately (no details refresh, no genres refresh, no credits/person work).
- With `--force`: existing movies are refreshed (details, `movie_genre`, and movie credits/person relationships are resynced).
- If missing, it fetches TMDB data and inserts a new movie.

For inserted or force-refreshed movies, genre associations are synced in `public.movie_genre` from the `genres[]` array on the TMDB payload. Each TMDB genre `id` is looked up in `genres.tmdb_id`; any genre not found in the local table is skipped with a warning (run `seed:tmdb:genres` first to populate it).

For inserted or force-refreshed movies, it fetches credits from `GET /movie/{id}/credits` and syncs `public.movie_credits` rows:

- For each distinct credited person, `ingestPerson` (from `inject_person.js`) is invoked on the same transaction; existing people are skipped, missing people are inserted before their credit row is written.
- Cast entries are linked to the job `"Actor"` in department `"Acting"`, with `title` set to the `character` string.
- Crew entries are linked to the job matching `crew.job` in department `crew.department`, with `title = null` (the role is encoded in `job_id`).
- Duplicate TMDB entries (same person + role) are deduped before insert.
- Job resolution is case-insensitive and job-first:
  - It first searches globally by job name (ignoring department and letter case).
  - If exactly one job-name match exists, that job is used even if TMDB department differs.
  - If multiple matches exist (same job name in multiple departments), department is used only to disambiguate (case-insensitive).
  - If no global match exists, the resolver creates/fetches the TMDB department (case-insensitive) and creates the job in that department.
  - If multiple job-name matches exist but none match the TMDB department, the credit is skipped with an ambiguity warning.

Each movie sync runs inside one transaction (movie row, genre links, person ingestion, and credits) and is idempotent — safe to rerun.

The script exports a reusable function `ingestMovie({ tmdbId, apiKey, onPrefetchProgress, forceRefreshExisting, refreshScope })` for use by other scripts (e.g. bulk loaders and refresh jobs). The `refreshScope` lets callers gate phases (`details`, `genres`, `credits`) but the change-driven runner always passes either `null` (full sync) or no scope at all, because cast/crew credits must always be re-injected together with the movie row. The mechanism remains in place for future use (and for tests) but is not used to skip credits in production refresh paths.

## TMDB popular movies today ingestion

Command:

`npm run seed:tmdb:popular-movies-today -- --limit=<count>`

Description:

Fetches today’s TMDB popular movies from `GET /movie/popular` (paged), takes the first `limit` results (default `20`, max `500`), and checks which `tmdb_id` values already exist in `public.movie`.

Existing movies are skipped, and no connected ingestion work runs for them (no movie details refresh, no genres refresh, no credits/person refresh). Only missing movies run through `ingestMovie`, which inserts the movie with genres and credits/person relationships.

The script writes a top-level `script_logs` row (`inject_popular_movies_today:limit=<count>`) and prints a final summary with requested count, skipped existing count, skipped race count, and inserted count.

If the process is interrupted (Ctrl+C / SIGTERM), a `script_logs` row is written with `status = 'stopped'`, `error_code = 'StoppedBySignal'`, and the signal name in `error_detail`. A guard ensures exactly one log row is written per run.

If one or more items fail during processing, the run finishes with `status = 'failure'` and `error_detail` contains JSON with aggregate summary fields plus a `failedItems` array of `{ entityType, tmdbId }`.

## TMDB popular people today ingestion

Command:

`npm run seed:tmdb:popular-people-today -- --limit=<count>`

Description:

Fetches today’s TMDB popular people from `GET /person/popular` (paged), takes the first `limit` results (default `20`, max `500`), and checks which `tmdb_id` values already exist in `public.person`.

Existing people are skipped, and no refresh/update is performed for those rows. Only missing people run through `ingestPerson`, which inserts the person and their AKA values.

The script writes a top-level `script_logs` row (`inject_popular_people_today:limit=<count>`) and prints a final summary with requested count, skipped existing count, skipped race count, and inserted count.

If the process is interrupted (Ctrl+C / SIGTERM), a `script_logs` row is written with `status = 'stopped'`, `error_code = 'StoppedBySignal'`, and the signal name in `error_detail`. A guard ensures exactly one log row is written per run.

If one or more items fail during processing, the run finishes with `status = 'failure'` and `error_detail` contains JSON with aggregate summary fields plus a `failedItems` array of `{ entityType, tmdbId }`.

## TMDB popular shows today ingestion

Command:

`npm run seed:tmdb:popular-shows-today -- --limit=<count>`

Description:

Fetches today’s TMDB popular TV shows from `GET /tv/popular` (paged), takes the first `limit` results (default `20`, max `500`), and checks which `tmdb_id` values already exist in `public.show`.

Existing shows are skipped, and no refresh/update is performed for those rows. Only missing shows run through `ingestTvShow`, which inserts the show and runs the same downstream ingestion phases as single-show ingestion.

The script writes a top-level `script_logs` row (`inject_popular_shows_today:limit=<count>`) and prints a final summary with requested count, skipped existing count, skipped race count, and inserted count.

If the process is interrupted (Ctrl+C / SIGTERM), a `script_logs` row is written with `status = 'stopped'`, `error_code = 'StoppedBySignal'`, and the signal name in `error_detail`. A guard ensures exactly one log row is written per run.

If one or more items fail during processing, the run finishes with `status = 'failure'` and `error_detail` contains JSON with aggregate summary fields plus a `failedItems` array of `{ entityType, tmdbId }`.

## TMDB popularity-only refresh

Aggregator command (single run touches multiple entities):

`npm run seed:tmdb:update-popularity -- --entity=<movie|show|person|all> --page-size=<count> --limit=<count> --fetch-concurrency=<count>`

Entity-specific commands (no `--entity` flag accepted):

- `npm run seed:tmdb:update-popularity:movies -- --page-size=<count> --limit=<count> --fetch-concurrency=<count>`
- `npm run seed:tmdb:update-popularity:shows -- --page-size=<count> --limit=<count> --fetch-concurrency=<count>`
- `npm run seed:tmdb:update-popularity:people -- --page-size=<count> --limit=<count> --fetch-concurrency=<count>`

Description:

Refreshes only popularity values for existing rows by reading local `tmdb_id` values in pages, fetching TMDB detail payloads, and performing bulk updates.

- movies update `movie.tmdb_popularity` from `GET /movie/{id}`.
- shows update `show.tmdb_popularity` from `GET /tv/{id}`.
- people update `person.popularity` from `GET /person/{id}`.
- aggregator with `--entity=all` (default) runs movie, then show, then person.

Only rows with `deleted_at IS NULL` are considered. Updates use `IS DISTINCT FROM` checks so unchanged popularity values are skipped without rewriting rows.

Defaults:

- aggregator: `--entity=all`; entity-specific scripts have a fixed entity and reject `--entity`.
- `--page-size=1000` (max `5000`)
- `--fetch-concurrency=128` (max `512`)
- `--limit` omitted means full-table scan per selected entity

Each script writes a top-level `script_logs` row prefixed with its script name:

- aggregator: `update_tmdb_popularity:entity=<...>:pageSize=<...>:limit=<...>:fetchConcurrency=<...>`
- entity-specific: `update_tmdb_popularity_movies:entity=movie:...`, `update_tmdb_popularity_shows:entity=show:...`, `update_tmdb_popularity_people:entity=person:...`

The final summary printed to stdout includes fetched, updated, missing-on-TMDB, and failed counts.

## TMDB top-rated movies ingestion

Command:

`npm run seed:tmdb:top-rated-movies -- --limit=<count>`

Description:

Fetches TMDB top-rated movies from `GET /movie/top_rated` (paged), takes the first `limit` results (default `20`, max `500`), and checks which `tmdb_id` values already exist in `public.movie`.

Existing movies are skipped, and no connected ingestion work runs for them (no movie details refresh, no genres refresh, no credits/person refresh). Only missing movies run through `ingestMovie`, which inserts the movie with genres and credits/person relationships.

The script writes a top-level `script_logs` row (`inject_top_rated_movies:limit=<count>`) and prints a final summary with requested count, skipped existing count, skipped race count, and inserted count.

If the process is interrupted (Ctrl+C / SIGTERM), a `script_logs` row is written with `status = 'stopped'`, `error_code = 'StoppedBySignal'`, and the signal name in `error_detail`. A guard ensures exactly one log row is written per run.

If one or more items fail during processing, the run finishes with `status = 'failure'` and `error_detail` contains JSON with aggregate summary fields plus a `failedItems` array of `{ entityType, tmdbId }`.

## TMDB top-rated shows ingestion

Command:

`npm run seed:tmdb:top-rated-shows -- --limit=<count>`

Description:

Fetches TMDB top-rated TV shows from `GET /tv/top_rated` (paged), takes the first `limit` results (default `20`, max `500`), and checks which `tmdb_id` values already exist in `public.show`.

Existing shows are skipped, and no refresh/update is performed for those rows. Only missing shows run through `ingestTvShow`, which inserts the show and runs the same downstream ingestion phases as single-show ingestion.

The script writes a top-level `script_logs` row (`inject_top_rated_shows:limit=<count>`) and prints a final summary with requested count, skipped existing count, skipped race count, and inserted count.

If the process is interrupted (Ctrl+C / SIGTERM), a `script_logs` row is written with `status = 'stopped'`, `error_code = 'StoppedBySignal'`, and the signal name in `error_detail`. A guard ensures exactly one log row is written per run.

If one or more items fail during processing, the run finishes with `status = 'failure'` and `error_detail` contains JSON with aggregate summary fields plus a `failedItems` array of `{ entityType, tmdbId }`.

## Granular changed-entity refresh

All `seed:tmdb:changed-*` scripts share the same partial-refresh strategy:

1. Discover candidate IDs from `GET /{entity}/changes` for the date window.
2. Intersect with existing local rows (other matches are dropped).
3. For each surviving id, fetch the per-entity changelog (`GET /{entity}/{id}/changes`) and classify the change keys into a refresh scope.
4. Call the entity ingest function with that scope so only the changed parts are touched.

### Credits are always coupled with their parent entity

Cast and crew credits **must always travel with the parent object**. There is no scenario where a movie's `overview` is refreshed without also re-syncing its `cast`/`crew`, and the same holds for show-level credits when the show row is refreshed and for episode-level credits when an episode is refreshed. This guarantees that on every initial insertion of an object **and** on every refresh, credits are re-injected together with whatever else changed.

Granularity is therefore restricted to two well-defined cases:

- **Movies** — any TMDB change to a movie triggers a full refresh of the movie row, its genre links, and its credits. There is no partial movie refresh.
- **Shows** — when the TMDB changelog for a show contains **only** `episode` keys whose items carry valid `season_number`/`episode_number` (and optionally `episode_id`), the runner refreshes only those specific `(season_number, episode_number)` episodes (and their per-episode credits). It does not touch the show row, the show-level credits, the seasons, or any other episodes. Any other set of changes (including show-level `name`/`overview`/`cast`, season-level keys, or episode keys without usable identifiers) triggers a full refresh of the show + show credits + every season + every episode + every episode's credits.
- **People** — `details` (person row + `known_for_department`) and `aka` (`person_aka` sync) are independent and remain individually scopable, since people have no associated credits in this scope.

When the per-entity changelog is empty, the row is reported as `unchanged` and is not written to.

Each runner reports these counters:

- `refreshed` — total entities updated.
- `refreshedFull` — full sync ran (movies always fall in this bucket when they have any change; shows fall here whenever the change is not a clean targeted-episode set).
- `refreshedScoped` — only the changed phases ran (people only — movies and shows never produce this counter under the current rules; reserved for future use).
- `refreshedTargeted` — shows only: only the targeted episodes (and their credits) were refreshed.
- `unchanged` — no field-level changes detected.
- `failed`, `skippedRace` — same semantics as before.

## TMDB changed movies in last 24h refresh

Command:

`npm run seed:tmdb:changed-movies-24h -- --limit=<count> --start-date=<yyyy-mm-dd> --end-date=<yyyy-mm-dd>`

Description:

Fetches changed movie IDs from `GET /movie/changes` for the requested date window. If no dates are passed, it defaults to the last 24 hours. `--limit` defaults to `100000` (max `100000`).

Changed IDs are cached in-memory for the run, then filtered to movies that already exist in `public.movie`. Only existing rows are refreshed. Any non-empty changelog triggers a full movie refresh (details + genres + cast/crew credits) so that credits stay coupled with the movie row (see [Granular changed-entity refresh](#granular-changed-entity-refresh)). Movies with an empty changelog are reported as `unchanged`.

The script writes a top-level `script_logs` row (`inject_changed_movies_24h:limit=<count>`) and prints changed fetched, matched existing, refreshed (full vs scoped), unchanged, failed, and skipped-race totals.

If the process is interrupted (Ctrl+C / SIGTERM), a `script_logs` row is written with `status = 'stopped'`, `error_code = 'StoppedBySignal'`, and the signal name in `error_detail`. A guard ensures exactly one log row is written per run.

If one or more items fail during processing, the run finishes with `status = 'failure'` and `error_detail` contains JSON with aggregate summary fields plus a `failedItems` array of `{ entityType, tmdbId }`.

## TMDB changed shows in last 24h refresh

Command:

`npm run seed:tmdb:changed-shows-24h -- --limit=<count> --start-date=<yyyy-mm-dd> --end-date=<yyyy-mm-dd>`

Description:

Fetches changed show IDs from `GET /tv/changes` for the requested date window. If no dates are passed, it defaults to the last 24 hours. `--limit` defaults to `100000` (max `100000`).

Changed IDs are cached in-memory for the run, then filtered to shows that already exist in `public.show`. Only existing rows are refreshed (see [Granular changed-entity refresh](#granular-changed-entity-refresh)).

Episode-level granularity is preserved: when the only TMDB change keys are `episode` items with valid `(season_number, episode_number)` locators, the runner refreshes only those specific episodes and their per-episode credits, leaving the show row, show-level credits, seasons, and other episodes untouched (`refreshedTargeted` counter). Any other change — show details, genres, show cast/crew, season-level keys, or episode items without usable identifiers — triggers a full refresh of the show and every season/episode (with credits) so that show credits and episode credits never drift out of sync with their parents.

The script writes a top-level `script_logs` row (`inject_changed_shows_24h:limit=<count>`) and prints changed fetched, matched existing, refreshed (full vs scoped vs targetedEpisodes), unchanged, failed, and skipped-race totals.

If the process is interrupted (Ctrl+C / SIGTERM), a `script_logs` row is written with `status = 'stopped'`, `error_code = 'StoppedBySignal'`, and the signal name in `error_detail`. A guard ensures exactly one log row is written per run.

If one or more items fail during processing, the run finishes with `status = 'failure'` and `error_detail` contains JSON with aggregate summary fields plus a `failedItems` array of `{ entityType, tmdbId }`.

## TMDB changed people in last 24h refresh

Command:

`npm run seed:tmdb:changed-people-24h -- --limit=<count> --start-date=<yyyy-mm-dd> --end-date=<yyyy-mm-dd>`

Description:

Fetches changed person IDs from `GET /person/changes` for the requested date window. If no dates are passed, it defaults to the last 24 hours. `--limit` defaults to `100000` (max `100000`).

Changed IDs are cached in-memory for the run, then filtered to people that already exist in `public.person`. Only existing rows are refreshed, scoped to either `details` (person row), `aka` (person AKA sync), or both — based on the per-person changelog (see [Granular changed-entity refresh](#granular-changed-entity-refresh)). People with an empty changelog are reported as `unchanged`.

The script writes a top-level `script_logs` row (`inject_changed_people_24h:limit=<count>`) and prints changed fetched, matched existing, refreshed (full vs scoped), unchanged, failed, and skipped-race totals.

If the process is interrupted (Ctrl+C / SIGTERM), a `script_logs` row is written with `status = 'stopped'`, `error_code = 'StoppedBySignal'`, and the signal name in `error_detail`. A guard ensures exactly one log row is written per run.

If one or more items fail during processing, the run finishes with `status = 'failure'` and `error_detail` contains JSON with aggregate summary fields plus a `failedItems` array of `{ entityType, tmdbId }`.

## TMDB changed all entities in last 24h refresh

Command:

`npm run seed:tmdb:changed-all-24h -- --limit=<count> --start-date=<yyyy-mm-dd> --end-date=<yyyy-mm-dd>`

Description:

Runs all three refresh scripts in sequence for the same date window and limit (`--limit` defaults to `100000`, max `100000`):

- changed movies (`GET /movie/changes`)
- changed shows (`GET /tv/changes`)
- changed people (`GET /person/changes`)

Each underlying script still does in-memory ID caching for that run, intersects changed IDs with existing rows in your DB, and refreshes only existing records in isolated transactions — using the same scoped/targeted partial-refresh strategy described in [Granular changed-entity refresh](#granular-changed-entity-refresh).

The orchestrator writes a top-level `script_logs` row (`inject_changed_all_24h:limit=<count>`) and prints per-entity plus total refreshed/failed counters, including the `full` / `scoped` / `targetedEpisodes` / `unchanged` breakdown so you can see how much work was avoided.

If the process is interrupted (Ctrl+C / SIGTERM), a `script_logs` row is written with `status = 'stopped'`, `error_code = 'StoppedBySignal'`, and the signal name in `error_detail`. A guard ensures exactly one log row is written per run.

If one or more items fail during processing, the run finishes with `status = 'failure'` and `error_detail` contains JSON with aggregate summary fields plus a `failedItems` array of `{ entityType, tmdbId }`.
