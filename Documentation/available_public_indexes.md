# Public schema indexes (Watchpapa)

Snapshot of indexes on `public` tables: metadata columns are `is_unique`, `is_primary`, `is_valid`, `is_ready` (all listed here are valid and ready). `index_predicate` is null unless a partial index.

For each index: short note on **what it’s for** in query plans and constraints.

---

## `department`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `department_pkey` | yes | yes | — | btree `(id)` — primary key lookup. |

---

## `episode`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `episode_pkey` | yes | yes | — | btree `(id)` — PK. |
| `episode_season_id_episode_number_idx` | no | no | — | btree `(season_id, episode_number)` — list/order episodes in a season. |
| `episode_tmdb_id_key` | yes | no | — | btree `(tmdb_id)` — one row per TMDB episode; upsert/sync by `tmdb_id`. |

---

## `episode_credits`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `episode_credits_episode_id_idx` | no | no | — | btree `(episode_id)` — credits for an episode. |
| `episode_credits_person_id_idx` | no | no | — | btree `(person_id)` — episodes a person is credited on. |
| `episode_credits_pkey` | yes | yes | — | btree `(id)` — PK. |

---

## `genres`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `genres_pkey` | yes | yes | — | btree `(id)` — PK. |

---

## `job`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `job_pkey` | yes | yes | — | btree `(id)` — PK. |

---

## `movie`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `movie_pkey` | yes | yes | — | btree `(id)` — PK. |
| `movie_tmdb_id_key` | yes | no | — | btree `(tmdb_id)` — one row per TMDB movie; upsert/lookup. |
| `movie_tmdb_popularity_desc_idx` | no | no | `deleted_at IS NULL` | btree `(tmdb_popularity DESC, id DESC)` — popular active movies (browses / ordering). |
| `movie_tmdb_popularity_desc_non_adult_idx` | no | no | `adult = false AND deleted_at IS NULL` | btree `(tmdb_popularity DESC, id DESC)` — popular **non-adult** active movies. |

---

## `movie_credits`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `movie_credits_movie_id_idx` | no | no | — | btree `(movie_id)` — cast/crew for a movie. |
| `movie_credits_person_id_idx` | no | no | — | btree `(person_id)` — filmography by person. |
| `movie_credits_pkey` | yes | yes | — | btree `(id)` — PK. |

---

## `movie_genre`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `movie_genre_movie_id_genres_id_idx` | no | no | — | btree `(movie_id, genres_id)` — join/filter by movie and genre. |
| `movie_genre_pkey` | yes | yes | — | btree `(id)` — PK. |

---

## `person`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `person_pkey` | yes | yes | — | btree `(id)` — PK. |
| `person_tmdb_id_key` | yes | no | — | btree `(tmdb_id)` — one row per TMDB person; upsert/sync by `tmdb_id`. |

---

## `person_aka`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `person_aka_pkey` | yes | yes | — | btree `(id)` — PK. |

---

## `profile`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `profile_pkey` | yes | yes | — | btree `(id)` — PK, aligns with `auth.users`. |
| `profile_username_key` | yes | no | — | btree `(username)` — login/display name uniqueness. |

---

## `season`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `season_pkey` | yes | yes | — | btree `(id)` — PK. |
| `season_tmdb_id_key` | yes | no | — | btree `(tmdb_id)` — one row per TMDB season; upsert/sync by `tmdb_id`. |
| `season_show_id_season_number_idx` | no | no | — | btree `(show_id, season_number)` — find season N of a show. |

---

## `show`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `show_pkey` | yes | yes | — | btree `(id)` — PK. |
| `show_tmdb_id_key` | yes | no | — | btree `(tmdb_id)` — one row per TMDB show. |
| `show_tmdb_popularity_desc_idx` | no | no | `deleted_at IS NULL` | btree `(tmdb_popularity DESC, id DESC)` — popular active shows. |
| `show_tmdb_popularity_desc_non_adult_idx` | no | no | `adult = false AND deleted_at IS NULL` | btree `(tmdb_popularity DESC, id DESC)` — popular **non-adult** active shows. |

---

## `show_credits`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `show_credits_person_id_idx` | no | no | — | btree `(person_id)` — shows a person is credited on. |
| `show_credits_pkey` | yes | yes | — | btree `(id)` — PK. |
| `show_credits_show_id_idx` | no | no | — | btree `(show_id)` — credits for a show. |

---

## `show_genre`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `show_genre_show_id_genres_id_idx` | no | no | — | btree `(show_id, genres_id)` — join/filter by show and genre. |
| `show_genre_pkey` | yes | yes | — | btree `(id)` — PK. |

---

## `user_followed_movies`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `user_followed_movies_pkey` | yes | yes | — | btree `(id)` — PK. |
| `user_followed_movies_user_id_created_at_idx` | no | no | — | btree `(user_id, created_at DESC)` — list a user’s followed movies by recency. |
| `user_followed_movies_user_id_movie_id_key` | yes | no | — | btree `(user_id, movie_id)` — at most one follow row per user+movie. |

---

## `user_followed_shows`

| index_name | unique | primary | predicate | definition (summary) |
|------------|--------|---------|-------------|----------------------|
| `user_followed_shows_pkey` | yes | yes | — | btree `(id)` — PK. |
| `user_followed_shows_user_id_created_at_idx` | no | no | — | btree `(user_id, created_at DESC)` — list a user’s followed shows by recency. |
| `user_followed_shows_user_id_show_id_key` | yes | no | — | btree `(user_id, show_id)` — at most one follow row per user+show. |