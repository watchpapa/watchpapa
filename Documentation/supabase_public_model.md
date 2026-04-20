# Supabase Public Model (Watchpapa)

This document explains the `public` schema model used for media metadata (movies, shows, people, credits, genres) and user follow relationships.

## Overview

The schema is centered around three content types:

- `movie`
- `show`
- `person`

From those core entities, the model adds:

- taxonomy tables (`department`, `job`, genre lookup tables),
- structure tables for TV (`season`, `episode`),
- many-to-many join tables for credits and genres,
- an optional `profile` row per auth user (`profile.id` references `auth.users`),
- user follow tables tied to `profile`.

Most tables use:

- `id bigint` primary keys (many with identity generation); exceptions are `profile` (`uuid` PK aligned with `auth.users`) and `episode` (`bigint` PK without identity in this DDL),
- `created_at` with UTC default,
- optional `updated_at` and `deleted_at` for lifecycle tracking.

---

## Core Content Tables

### `movie`

Stores TMDB movie metadata: `adult`, `budget`, `origianl_language` (column name as in DB), `original_title`, `overview`, `tmdb_popularity`, `release_date`, `revenue`, `runtime`, `status`, `tagline`, `title`, `tmdb_vote_avg`, `tmdb_vote_count`.

- Primary key: `id` (`bigint`, identity)
- External source key: `tmdb_id` (unique)
- Soft delete support: `deleted_at`

### `show`

Stores TMDB TV show metadata: `adult`, `episode_run_time`, `first_air_date`, `in_production`, `last_air_date`, `name`, `number_of_episodes`, `number_of_seasons`, `original_language`, `original_name`, `overview`, `tmdb_popularity`, `status`, `tagline`, `type`, `tmdb_vote_avg`, `tmdb_vote_count`.

- Primary key: `id` (`bigint`, identity)
- Unique external source key: `tmdb_id` (unique constraint)

### `person`

Stores cast/crew person records from TMDB: `name`, `adult`, `biography`, `birthday`, optional `place_of_birth` and `deathday`, `gender`, `popularity`.

- Primary key: `id` (`bigint`, identity)
- External source key: `tmdb_id`

### `person_aka`

Alternate names for people (`nickname` text, required).

- Many AKA rows can belong to one `person`
- Foreign key: `person_id -> person.id`

---

## TV Structure

### `season`

Represents a season of a show.

- Primary key: `id` (`bigint`, identity)
- Foreign key: `show_id -> show.id`
- Includes `tmdb_id`, `season_number`, `name`, `overview`, `air_date`, and lifecycle timestamps

### `episode`

Represents an episode in a season.

- Primary key: `id` (`bigint`, not generated in this schema; supplied by the application sync layer together with `tmdb_id`)
- Foreign key: `season_id -> season.id`
- Required fields include `tmdb_id`, `name`, `episode_number`, `overview`, `runtime`, `air_date`

Relationship chain:

- `show` 1 -> many `season`
- `season` 1 -> many `episode`

---

## Departments and Jobs

### `department`

Top-level production group (for example, directing, writing, production).

- Primary key: `id` (`bigint`, identity)
- Optional `name`; `created_at` / `updated_at` / `deleted_at` for lifecycle

### `job`

Specific role under a department.

- Primary key: `id` (`bigint`, identity)
- Foreign key: `department_id -> department.id` (required)
- Required `name`

This model lets credits point to a normalized role (`job`) instead of storing free-text role names everywhere.

---

## Credits (Many-to-Many with Role Context)

Credits are separated by content type:

- `movie_credits`
- `show_credits`
- `episode_credits`

Each credit row links:

- one content record (`movie_id` / `show_id` / `episode_id`)
- one `person_id`
- one `job_id`
- optional `title` (contextual credit label)

This creates reusable person/job links across all media levels.

---

## Genre Modeling

Genre catalogs are split by media type:

- `possible_movie_genres`
- `possible_show_genres`

Join tables assign genres to content:

- `movie_genre` links `movie` to `possible_movie_genres`
- `show_genre` links `show` to `possible_show_genres`

So:

- `movie` many-to-many `possible_movie_genres`
- `show` many-to-many `possible_show_genres`

Genre lookup tables (`possible_movie_genres`, `possible_show_genres`) store `name`, `tmdb_id`, and lifecycle columns. Join rows use identity `id` keys on `movie_genre` and `show_genre`.

---

## User profile (`profile`)

Application-facing user record keyed by the same UUID as Supabase Auth.

- Primary key: `id` (`uuid`), foreign key `id -> auth.users(id)` (one row per auth user when present)
- `username` (unique), `date_of_birth`, `is_adult` (default `false`), `role` (default `0`)
- `created_at`, optional `updated_at` / `deleted_at`

Follow tables reference `profile.id`, not `auth.users` directly.

---

## User Follow Tables

### `user_followed_movies`

Tracks movies a user follows.

- Primary key: `id` (`bigint`, identity)
- Foreign key: `user_id -> profile.id`
- Foreign key: `movie_id -> movie.id`
- `created_at` default: `now()` at UTC (expression)

### `user_followed_shows`

Tracks shows a user follows.

- Primary key: `id` (`bigint`, identity)
- Foreign key: `user_id -> profile.id`
- Foreign key: `show_id -> show.id`
- `created_at` default: `now()` (no explicit UTC zone in the DDL)

These tables are the personalization layer between `profile` and media entities.

---

## Cardinality Summary

- `department` 1 -> many `job`
- `show` 1 -> many `season`
- `season` 1 -> many `episode`
- `person` 1 -> many `person_aka`
- `movie` many-to-many `person` via `movie_credits` (+ `job`)
- `show` many-to-many `person` via `show_credits` (+ `job`)
- `episode` many-to-many `person` via `episode_credits` (+ `job`)
- `movie` many-to-many movie genres via `movie_genre`
- `show` many-to-many show genres via `show_genre`
- `auth.users` 1 -> 0..1 `profile` (same UUID as `profile.id` when a profile row exists)
- `profile` 1 -> many rows in `user_followed_movies` and `user_followed_shows`

---

## Current RLS Policies

From the current Supabase policies configuration (screenshots), the `public` schema is using the policies below. The `profile` table exists in the data model but is not listed in this inventory; extend this section when `profile` policies are captured.

### Read policies (applied to `anon`, `authenticated`)

- `department`: `public_read_department_select` (`SELECT`)
- `episode`: `public_read_episode_select` (`SELECT`)
- `episode_credits`: `public_read_episode_credits_select` (`SELECT`)
- `job`: `public_read_job_select` (`SELECT`)
- `movie`: `public_read_movie_select` (`SELECT`)
- `movie_credits`: `public_read_movie_credits_select` (`SELECT`)
- `movie_genre`: `public_read_movie_genre_select` (`SELECT`)
- `person`: `public_read_person_select` (`SELECT`)
- `person_aka`: `public_read_person_aka_select` (`SELECT`)
- `possible_movie_genres`: `public_read_possible_movie_genres_select` (`SELECT`)
- `possible_show_genres`: `public_read_possible_show_genres_select` (`SELECT`)
- `season`: `public_read_season_select` (`SELECT`)
- `show`: `public_read_show_select` (`SELECT`)
- `show_credits`: `public_read_show_credits_select` (`SELECT`)
- `show_genre`: `public_read_show_genre_select` (`SELECT`)

### Follow-table ownership policies (`authenticated` only)

For `user_followed_movies`:

- `user_followed_movies_select_own` (`SELECT`)
- `user_followed_movies_insert_own` (`INSERT`)
- `user_followed_movies_update_own` (`UPDATE`)
- `user_followed_movies_delete_own` (`DELETE`)

For `user_followed_shows`:

- `user_followed_shows_select_own` (`SELECT`)
- `user_followed_shows_insert_own` (`INSERT`)
- `user_followed_shows_update_own` (`UPDATE`)
- `user_followed_shows_delete_own` (`DELETE`)

---

## Notes and Observations

- Timestamp defaults are mostly `(now() AT TIME ZONE 'utc')`; `movie_genre.created_at` and `user_followed_shows.created_at` use plain `now()` in the DDL.
- Soft-delete fields (`deleted_at`) exist on many domain tables but not on credit or genre join tables (`movie_credits`, `show_credits`, `episode_credits`, `movie_genre`, `show_genre`) or follow tables.
- There is an apparent typo in `movie.origianl_language` (likely intended `original_language`).
- `episode_credits`, `movie_credits`, and `show_credits` have `created_at` but no `updated_at` / `deleted_at` in this schema.
- Constraint names are explicit and clear, which is helpful for migrations and debugging.

