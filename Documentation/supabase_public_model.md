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
- user follow tables tied to `auth.users`.

Most tables use:

- `id bigint` primary keys (many with identity generation),
- `created_at` with UTC default,
- optional `updated_at` and `deleted_at` for lifecycle tracking.

---

## Core Content Tables

### `movie`

Stores TMDB movie metadata such as title, language, popularity, votes, budget/revenue, runtime, and release/status fields.

- Primary key: `id`
- External source key: `tmdb_id`
- Soft delete support: `deleted_at`

### `show`

Stores TMDB TV show metadata (name/original name, seasons/episodes count, air dates, production status, votes, type).

- Primary key: `id`
- Unique external source key: `tmdb_id` (unique constraint)

### `person`

Stores cast/crew person records from TMDB (name, biography, birthday, gender, popularity).

- Primary key: `id`
- External source key: `tmdb_id`

### `person_aka`

Alternate names (nicknames) for people.

- Many AKA rows can belong to one `person`
- Foreign key: `person_id -> person.id`

---

## TV Structure

### `season`

Represents a season of a show.

- Foreign key: `show_id -> show.id`
- Includes `season_number`, `air_date`, and season-level metadata

### `episode`

Represents an episode in a season.

- Foreign key: `season_id -> season.id`
- Includes `episode_number`, `air_date`, runtime, and overview

Relationship chain:

- `show` 1 -> many `season`
- `season` 1 -> many `episode`

---

## Departments and Jobs

### `department`

Top-level production group (for example, directing, writing, production).

### `job`

Specific role under a department.

- Foreign key: `department_id -> department.id`

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

---

## User Follow Tables

### `user_followed_movies`

Tracks movies a user follows.

- Foreign key: `user_id -> auth.users.id`
- Foreign key: `movie_id -> movie.id`

### `user_followed_shows`

Tracks shows a user follows.

- Foreign key: `user_id -> auth.users.id`
- Foreign key: `show_id -> show.id`
- `user_id` defaults to `auth.uid()`

These tables are the personalization layer between authenticated users and media entities.

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
- `auth.users` 1 -> many follows in `user_followed_movies` and `user_followed_shows`

---

## Current RLS Policies

From the current Supabase policies configuration (screenshots), the `public` schema is using:

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

- Timestamp defaults are mostly normalized to UTC.
- Soft-delete fields (`deleted_at`) exist on many domain tables but not all join tables.
- There is an apparent typo in `movie.origianl_language` (likely intended `original_language`).
- Constraint names are explicit and clear, which is helpful for migrations and debugging.

