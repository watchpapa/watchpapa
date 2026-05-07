# Database Query Audit

> Updated: 2026-05-07 — reflects genre upsert implementation, IS DISTINCT FROM dirty-checks, race-safe batchIngestPersons, resolveOrCreateJobId improvements, and new batch scripts (update_tmdb_popularity, inject_changed_*_24h)

---

## 1. Index Audit

### Complete live index list

| Table | Index | Unique | Definition | Purpose |
|-------|-------|--------|-----------|---------|
| `department` | `department_pkey` | ✓ | btree(id) | PK |
| `department` | `department_name_idx` | — | btree(name) | exact-name resolver lookup |
| `department` | `department_name_lower_idx` | — | btree(lower(name)) | case-insensitive resolver |
| `episode` | `episode_pkey` | ✓ | btree(id) | PK |
| `episode` | `episode_tmdb_id_key` | ✓ | btree(tmdb_id) | upsert conflict target |
| `episode` | `episode_season_id_episode_number_key` | ✓ | btree(season_id, episode_number) | prevents duplicate episodes; order within season |
| `episode` | `episode_air_date_idx` | — | btree(air_date) | future filter/sort by air date |
| `episode_credits` | `episode_credits_pkey` | ✓ | btree(id) | PK |
| `episode_credits` | `episode_credits_episode_id_idx` | — | btree(episode_id) | credits for an episode |
| `episode_credits` | `episode_credits_person_id_idx` | — | btree(person_id) | episodes a person is credited on |
| `episode_credits` | `episode_credits_created_at_idx` | — | btree(created_at) | audit / timeline queries |
| `genres` | `genres_pkey` | ✓ | btree(id) | PK |
| `genres` | `genres_tmdb_id_key` | ✓ | btree(tmdb_id) | genre lookup during injection |
| `job` | `job_pkey` | ✓ | btree(id) | PK |
| `job` | `job_department_id_name_idx` | — | btree(department_id, name) | resolver lookup by dept + job name |
| `job` | `job_name_lower_idx` | — | btree(lower(name)) | case-insensitive job resolver |
| `movie` | `movie_pkey` | ✓ | btree(id) | PK |
| `movie` | `movie_tmdb_id_key` | ✓ | btree(tmdb_id) | upsert conflict target |
| `movie` | `movie_tmdb_popularity_desc_idx` | — | partial btree(tmdb_popularity DESC, id DESC) WHERE deleted_at IS NULL | browse / order active movies |
| `movie` | `movie_tmdb_popularity_desc_non_adult_idx` | — | partial btree(tmdb_popularity DESC, id DESC) WHERE adult=false AND deleted_at IS NULL | browse non-adult |
| `movie` | `movie_title_trgm_idx` | — | GIN trigram(title) WHERE deleted_at IS NULL | ILIKE search on title |
| `movie` | `movie_orig_title_trgm_idx` | — | GIN trigram(original_title) WHERE deleted_at IS NULL | ILIKE search on original title |
| `movie` | `movie_created_at_idx` | — | btree(created_at) | timeline / feed queries |
| `movie_credits` | `movie_credits_pkey` | ✓ | btree(id) | PK |
| `movie_credits` | `movie_credits_movie_id_idx` | — | btree(movie_id) | cast/crew for a movie |
| `movie_credits` | `movie_credits_person_id_idx` | — | btree(person_id) | filmography by person |
| `movie_genre` | `movie_genre_pkey` | ✓ | btree(id) | PK |
| `movie_genre` | `movie_genre_movie_id_genres_id_unique` | ✓ | btree(movie_id, genres_id) | prevents duplicates; conflict target for genre upsert |
| `person` | `person_pkey` | ✓ | btree(id) | PK |
| `person` | `person_tmdb_id_key` | ✓ | btree(tmdb_id) | upsert conflict target |
| `person` | `person_popularity_desc_idx` | — | partial btree(popularity DESC) WHERE deleted_at IS NULL | search result ordering |
| `person` | `person_adult_idx` | — | btree(adult) | filter by adult flag |
| `person` | `person_name_trgm_idx` | — | GIN trigram(name) WHERE deleted_at IS NULL | ILIKE search on name |
| `person_aka` | `person_aka_pkey` | ✓ | btree(id) | PK |
| `person_aka` | `person_aka_person_id_idx` | — | btree(person_id) | AKA lookup by person |
| `person_aka` | `person_aka_nickname_trgm_idx` | — | GIN trigram(nickname) WHERE deleted_at IS NULL | ILIKE search on aliases |
| `profile` | `profile_pkey` | ✓ | btree(id) | PK |
| `profile` | `profile_username_key` | ✓ | btree(username) | unique username |
| `script_logs` | `script_logs_pkey` | ✓ | btree(id) | PK |
| `script_logs` | `script_logs_created_at_idx` | — | btree(created_at) | log timeline queries |
| `script_logs` | `script_logs_error_code_idx` | — | btree(error_code) | filter by error type |
| `season` | `season_pkey` | ✓ | btree(id) | PK |
| `season` | `season_tmdb_id_key` | ✓ | btree(tmdb_id) | upsert conflict target |
| `season` | `season_show_id_season_number_key` | ✓ | btree(show_id, season_number) | prevents duplicate seasons; lookup season N |
| `show` | `show_pkey` | ✓ | btree(id) | PK |
| `show` | `show_tmdb_id_key` | ✓ | btree(tmdb_id) | upsert conflict target |
| `show` | `show_tmdb_popularity_desc_idx` | — | partial btree(tmdb_popularity DESC, id DESC) WHERE deleted_at IS NULL | browse / order active shows |
| `show` | `show_tmdb_popularity_desc_non_adult_idx` | — | partial btree(tmdb_popularity DESC, id DESC) WHERE adult=false AND deleted_at IS NULL | browse non-adult |
| `show` | `show_name_trgm_idx` | — | GIN trigram(name) WHERE deleted_at IS NULL | ILIKE search on name |
| `show` | `show_orig_name_trgm_idx` | — | GIN trigram(original_name) WHERE deleted_at IS NULL | ILIKE search on original name |
| `show` | `show_created_at_idx` | — | btree(created_at) | timeline / feed queries |
| `show_credits` | `show_credits_pkey` | ✓ | btree(id) | PK |
| `show_credits` | `show_credits_show_id_idx` | — | btree(show_id) | credits for a show |
| `show_credits` | `show_credits_person_id_idx` | — | btree(person_id) | filmography by person |
| `show_genre` | `show_genre_pkey` | ✓ | btree(id) | PK |
| `show_genre` | `show_genre_show_id_genres_id_unique` | ✓ | btree(show_id, genres_id) | prevents duplicates; conflict target for genre upsert |
| `user_followed_movies` | `user_followed_movies_pkey` | ✓ | btree(id) | PK |
| `user_followed_movies` | `user_followed_movies_user_id_movie_id_unique` | ✓ | btree(profile_id, movie_id) | prevent duplicate follows |
| `user_followed_movies` | `user_followed_movies_user_id_created_at_idx` | — | btree(profile_id, created_at DESC) | user's follow list by recency |
| `user_followed_movies` | `user_followed_movies_movie_id_idx` | — | btree(movie_id) | reverse: who follows a movie |
| `user_followed_shows` | `user_followed_shows_pkey` | ✓ | btree(id) | PK |
| `user_followed_shows` | `user_followed_shows_user_id_show_id_unique` | ✓ | btree(profile_id, show_id) | prevent duplicate follows |
| `user_followed_shows` | `user_followed_shows_user_id_created_at_idx` | — | btree(profile_id, created_at DESC) | user's follow list by recency |
| `user_followed_shows` | `user_followed_shows_show_id_idx` | — | btree(show_id) | reverse: who follows a show |

---

## 2. All Used Queries & Estimated Timing

Timing assumes warm Supabase connection (~5–15 ms base latency).

### Search (`GET /api/search?q=...`)

Three queries run in parallel via `Promise.all`:

| # | Query | Index used | Est. time |
|---|-------|-----------|-----------|
| 1 | `SELECT … FROM movie WHERE deleted_at IS NULL AND (title ILIKE :pattern OR original_title ILIKE :pattern) ORDER BY tmdb_popularity DESC LIMIT :limit` | `movie_title_trgm_idx`, `movie_orig_title_trgm_idx` | 1–5 ms |
| 2 | `SELECT … FROM show WHERE deleted_at IS NULL AND (name ILIKE :pattern OR original_name ILIKE :pattern) ORDER BY tmdb_popularity DESC LIMIT :limit` | `show_name_trgm_idx`, `show_orig_name_trgm_idx` | 1–5 ms |
| 3 | `SELECT DISTINCT ON (p.id) … FROM person p LEFT JOIN person_aka pa … WHERE … ILIKE … ORDER BY p.id, p.popularity DESC LIMIT :limit` | `person_name_trgm_idx`, `person_aka_nickname_trgm_idx`, `person_popularity_desc_idx` | 1–10 ms |

**Total wall time:** ~1–10 ms (parallel).

---

### Resolve (`POST /api/resolve`)

| # | Query | Index used | Est. time |
|---|-------|-----------|-----------|
| 1 | `SELECT id FROM {movie\|show\|person} WHERE tmdb_id = :tmdbId AND deleted_at IS NULL LIMIT 1` | `{table}_tmdb_id_key` | <1 ms |
| 2 | `INSERT INTO {movie\|show\|person} (...) ON CONFLICT (tmdb_id) DO UPDATE SET ... RETURNING id` *(fastUpsert — partial fields, COALESCE to preserve poster_path)* | `{table}_tmdb_id_key` | 1–5 ms |

Endpoint returns after query 2; full ingest (`ingestMovie` / `ingestTvShow` / `ingestPerson` with `forceRefreshExisting: true`) runs asynchronously in background for all three entity types when a new row was created.

---

### Inject Movie (full ingest, inside transaction)

> **Genre phase changed:** previously DELETE-all + SELECT + INSERT. Now SELECT + upsert (ON CONFLICT DO NOTHING) + targeted DELETE, preserving `created_at` on unchanged genre links.
>
> **Person batch now race-safe:** an optional fallback SELECT resolves IDs for persons inserted concurrently by another process before the bulk INSERT returns them.
>
> **All upserts use `IS DISTINCT FROM`** to skip writes when no field actually changed.

| # | Query | Index used | Est. time |
|---|-------|-----------|-----------|
| 1 | `SELECT id FROM movie WHERE tmdb_id = :tmdbId LIMIT 1` | `movie_tmdb_id_key` | <1 ms |
| 2 | `INSERT INTO movie (...) ON CONFLICT (tmdb_id) DO UPDATE SET ... WHERE IS DISTINCT FROM ... RETURNING id, (xmax=0)` | `movie_tmdb_id_key` | 2–10 ms |
| 3 | `SELECT id, tmdb_id FROM genres WHERE tmdb_id IN (:gid0, …)` *(batch)* | `genres_tmdb_id_key` | <1 ms |
| 4 | `INSERT INTO movie_genre (movie_id, genres_id) VALUES (…) ON CONFLICT (movie_id, genres_id) DO NOTHING` *(bulk upsert)* | `movie_genre_movie_id_genres_id_unique` | <1 ms |
| 5 | `DELETE FROM movie_genre WHERE movie_id = :movieId AND genres_id NOT IN (:keep0, …)` *(targeted — only removes dropped genres)* | `movie_genre_movie_id_genres_id_unique` | <1 ms |
| 6 | `DELETE FROM movie_credits WHERE movie_id = :movieId` | `movie_credits_movie_id_idx` | <1 ms |
| 7 | `SELECT id, tmdb_id FROM person WHERE tmdb_id IN (:eid0, …)` *(batch existing check)* | `person_tmdb_id_key` | 1–3 ms |
| 8 | `INSERT INTO person (…) VALUES (…), (…) … ON CONFLICT (tmdb_id) DO NOTHING RETURNING id, tmdb_id` *(bulk)* | `person_tmdb_id_key` | 2–10 ms |
| 9 *(cond.)* | `SELECT id, tmdb_id FROM person WHERE tmdb_id IN (…)` *(fallback for ids another writer inserted first; only when stillMissing > 0)* | `person_tmdb_id_key` | <1 ms |
| 10 | `INSERT INTO person_aka (person_id, nickname) VALUES (…), (…)` *(bulk, new persons only)* | — | 1–5 ms |
| 11×J | `SELECT j.id, d.name FROM job j JOIN department d ON … WHERE LOWER(j.name) = LOWER(:jobName)` *(per unique job name, cached in Map; +2–3 extra for unknown jobs: dept SELECT/INSERT + job INSERT)* | `job_name_lower_idx` | <1 ms each |
| 12 | `INSERT INTO movie_credits (movie_id, person_id, job_id, title) VALUES (…), (…)` *(bulk)* | — | 1–5 ms |
| 13 | `INSERT INTO script_logs (…)` | — | <1 ms |

**Total: ~12 fixed queries + J unique job name lookups** (J typically 5–15, DB hit once then cached; unknown jobs add up to 3 extra queries each — rare after first run).

---

### Inject TV Show (full ingest, inside transaction)

Includes everything from movie injection plus per-season and per-episode work. Genre replacement and person batch follow the same updated patterns. Season and episode upserts also use `IS DISTINCT FROM` dirty-checks.

| # | Query | Index used | Est. time |
|---|-------|-----------|-----------|
| S1 per season | `INSERT INTO season (...) ON CONFLICT (tmdb_id) DO UPDATE SET ... WHERE IS DISTINCT FROM ... RETURNING id, (xmax=0)` | `season_tmdb_id_key` | 1–3 ms |
| S2 per episode | `INSERT INTO episode (...) ON CONFLICT (tmdb_id) DO UPDATE SET ... WHERE IS DISTINCT FROM ... RETURNING id, (xmax=0)` | `episode_tmdb_id_key` | 1–3 ms |
| S3 per episode | `DELETE FROM episode_credits WHERE episode_id = :episodeId` | `episode_credits_episode_id_idx` | <1 ms |
| S4 per episode | Batch SELECT + bulk INSERT for persons not yet seen in prior episodes *(personIdCache shared across all episodes — each tmdb_id hits DB at most once)* | `person_tmdb_id_key` | 1–5 ms |
| S5 per episode | `INSERT INTO episode_credits (...) VALUES (...), (...)` *(bulk)* | — | 1–3 ms |

**Typical show (3 seasons, 30 episodes, 60 unique persons): ~135 queries.** Previously 390–2,000+.

---

### Inject Person (standalone)

| # | Query | Index used | Est. time |
|---|-------|-----------|-----------|
| 1 | `SELECT id FROM person WHERE tmdb_id = :tmdbId LIMIT 1` | `person_tmdb_id_key` | <1 ms |
| 2 | `SELECT id FROM department WHERE name = :deptName LIMIT 1` | `department_name_idx` | <1 ms |
| 3 | `INSERT INTO person (...) ON CONFLICT (tmdb_id) DO NOTHING RETURNING id` | `person_tmdb_id_key` | 1–3 ms |
| 4 | `SELECT id, nickname, deleted_at FROM person_aka WHERE person_id = :personId` | `person_aka_person_id_idx` | <1 ms |
| 5×A | Insert / restore (`UPDATE … SET deleted_at = NULL`) / soft-delete (`UPDATE … SET deleted_at = now()`) AKA rows *(per AKA delta, individual queries)* | — | <1 ms each |
| 6 (force) | `UPDATE person SET ... WHERE id = :personId` | `person_pkey` | 1–3 ms |
| 7 | `INSERT INTO script_logs (...)` | — | <1 ms |

**Total:** 5–12 queries.

---

### Update TMDB Popularity (`update_tmdb_popularity.js`)

Keyset-paginated bulk popularity refresh for movie, show, and/or person. Runs per entity in pages of up to 5,000 rows with configurable TMDB fetch concurrency (default 128).

| # | Query | Index used | Est. time |
|---|-------|-----------|-----------|
| 1 per page | `SELECT id, tmdb_id FROM {movie\|show\|person} WHERE deleted_at IS NULL AND id > :lastId ORDER BY id LIMIT :pageSize` | btree(id) PK | 1–3 ms |
| 2 per page | `UPDATE {table} SET {popularity_col} = v.popularity, updated_at = now() FROM (SELECT tmdb_id, popularity FROM json_to_recordset(CAST(:json AS json)) AS x(tmdb_id BIGINT, popularity DOUBLE PRECISION)) WHERE t.tmdb_id = v.tmdb_id AND t.deleted_at IS NULL AND t.{col} IS DISTINCT FROM v.popularity` *(bulk; skips rows where value unchanged)* | `{table}_tmdb_id_key` | 2–20 ms |

**Per full run (all entities, ~N rows each):** 2 queries × ceil(N / pageSize) per entity. IS DISTINCT FROM ensures rows with unchanged popularity are not written.

---

### Inject Changed {Entity} 24h (`inject_changed_*_24h.js`)

Incremental refresh that re-ingests only local rows that TMDB reported as changed in the last 24 hours. Runs for movie, show, person, or all three sequentially.

| # | Query | Est. time |
|---|-------|-----------|
| 1 | `SELECT tmdb_id FROM {table} WHERE tmdb_id IN (:tmdbIds)` *(batch existence filter — keeps only TMDB-changed IDs that exist locally)* | <1 ms |
| 2 per entity | `SELECT tmdb_id FROM {table} WHERE tmdb_id IN (:singleId)` *(per-entity race check right before refresh, guards against mid-run deletes)* | <1 ms |
| 3 per entity | Full `ingestMovie` / `ingestTvShow` / `ingestPerson` with `forceRefreshExisting: true` + scoped `refreshScope` *(from `classifyMovieChanges` / `classifyShowChanges` / `classifyPersonChanges`)* | see inject sections |
| 4 | `INSERT INTO script_logs (…)` | <1 ms |

`refreshScope` allows partial refreshes (e.g., details-only, genres-only) when TMDB's field-level change list confirms only a subset of fields changed — avoiding unnecessary credit/season re-ingestion.

---

## 3. Injection Query Counts — Summary

| Entity | Before | After | Bottleneck removed |
|--------|--------|-------|-------------------|
| **Person** (standalone) | 5–10 | 5–10 | N/A |
| **Movie** | 150–600+ | ~12–14 | Per-person loop (4–5q each) → 3 bulk queries; genre upsert preserves history |
| **TV Show** | 300–2,000+ | ~135 (30 eps) | Same; episode count now dominates |

### Per-injection query breakdown (movie/show)

| Phase | Queries |
|-------|---------|
| Existence check | 1 |
| Upsert entity (IS DISTINCT FROM dirty-check) | 1 |
| Genre batch SELECT | 1 |
| Genre bulk INSERT upsert (ON CONFLICT DO NOTHING) | 1 |
| Genre targeted DELETE (removed genres only) | 1 |
| Delete old credits | 1 |
| Batch SELECT all persons (existing check) | 1 |
| Bulk INSERT new persons | 1 |
| Fallback SELECT still-missing persons (race, conditional) | 0–1 |
| Bulk INSERT new AKAs | 1 |
| Per-unique-job resolution (cached after first hit) | J |
| Bulk INSERT credits | 1 |
| Script log | 1 |
| **Total** | **~11–12 + J** |

---

## 4. Applied Optimizations

| Optimization | Status | Location |
|-------------|--------|---------|
| `genres(tmdb_id)` unique index | ✅ | `Backend/migrations/001_perf_indexes.sql` |
| `person(popularity DESC)` partial index | ✅ | `Backend/migrations/001_perf_indexes.sql` |
| GIN trigram indexes for ILIKE search (6 indexes) | ✅ | `Backend/migrations/001_perf_indexes.sql` |
| Batch genre lookup (1 SELECT + 1 bulk upsert + 1 targeted DELETE) | ✅ | `inject_movie.js`, `inject_tv_show.js` |
| Genre upsert using unique constraint (preserves `created_at`; only deletes removed genres) | ✅ | `inject_movie.js`, `inject_tv_show.js` |
| Batch person ingestion (`batchIngestPersons`) with race-safe fallback SELECT | ✅ | `inject_person.js`, `inject_movie.js`, `inject_tv_show.js` |
| IS DISTINCT FROM dirty-check on all entity upserts (movie, show, season, episode) | ✅ | `inject_movie.js`, `inject_tv_show.js` |
| `resolveOrCreateJobId`: auto-creates unknown departments + jobs; JOIN-based dept disambiguation | ✅ | `resolve_job.js` |
| Keyset-paginated bulk popularity refresh (`update_tmdb_popularity.js`) | ✅ | `update_tmdb_popularity.js` |
| Scoped incremental refresh for changed entities (`inject_changed_*_24h.js`) | ✅ | `inject_changed_movies_24h.js`, `inject_changed_shows_24h.js`, `inject_changed_people_24h.js`, `inject_changed_all_24h.js` |
| Drop 14 redundant / duplicate indexes | ✅ | Run in Supabase SQL editor |

## 5. Future Opportunities

| Opportunity | Benefit | Notes |
|------------|---------|-------|
| Batch AKA sync in `ingestPerson` (standalone) | Reduces per-AKA round-trips from individual UPDATEs to a single bulk operation | Currently `syncPersonAka` issues one query per insert/restore/soft-delete; `batchIngestPersons` already does bulk AKA inserts — the standalone path could adopt the same pattern |
| Scope-aware credit refresh (movie/show) | Skip full credit re-ingest when TMDB change set only touches details/genres | `classifyMovieChanges` already returns a `scope` object; the credits DELETE + re-ingest is currently unconditional when `effectiveScope.credits` is true — could short-circuit when credits not in scope |
| Parallel season fetches in `runSeasonsTransaction` | Reduce wall time for large shows by fetching multiple season payloads concurrently | Currently sequential per-season; bounded concurrency pool (like `runWithConcurrency` in popularity script) would cut wall time proportionally |
