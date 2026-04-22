# Supabase Public Model (Watchpapa)

This document explains the `public` schema model used for media metadata (movies, shows, people, credits, genres) and user follow relationships.

## Overview

The schema is centered around three content types:

- `movie`
- `show`
- `person`

From those core entities, the model adds:

- taxonomy tables (`department`, `job`, and a single `genres` lookup),
- structure tables for TV (`season`, `episode`),
- many-to-many join tables for credits and genres,
- an optional `profile` row per auth user (`profile.id` references `auth.users`),
- user follow tables tied to `profile`,
- optional `script_logs` for script/ETL run outcomes.

Most tables use:

- `id bigint` primary keys (many with identity generation); exceptions are `profile` (`uuid` PK aligned with `auth.users`) and `episode` (`bigint` PK without identity in this DDL),
- `created_at` with UTC default,
- optional `updated_at` and `deleted_at` for lifecycle tracking.

## Full public schema DDL (reference only)

The following is an exported snapshot of the `public` objects as defined in the database. It is for documentation and design review; do not run as a migration as-is (table order and dependencies may not match execution requirements).

```sql
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.department (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT department_pkey PRIMARY KEY (id)
);
CREATE TABLE public.episode (
  id bigint NOT NULL,
  tmdb_id bigint NOT NULL,
  season_id bigint NOT NULL,
  name text NOT NULL,
  episode_number bigint NOT NULL,
  overview text NOT NULL,
  runtime bigint NOT NULL,
  air_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT episode_pkey PRIMARY KEY (id),
  CONSTRAINT episode_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.season(id)
);
CREATE TABLE public.episode_credits (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  episode_id bigint NOT NULL,
  person_id bigint NOT NULL,
  job_id bigint NOT NULL,
  title text,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  CONSTRAINT episode_credits_pkey PRIMARY KEY (id),
  CONSTRAINT episode_credits_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episode(id),
  CONSTRAINT episode_credits_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id),
  CONSTRAINT episode_credits_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job(id)
);
CREATE TABLE public.genres (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  tmdb_id bigint NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT genres_pkey PRIMARY KEY (id)
);
CREATE TABLE public.job (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  department_id bigint NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT job_pkey PRIMARY KEY (id),
  CONSTRAINT job_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id)
);
CREATE TABLE public.movie (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tmdb_id bigint NOT NULL UNIQUE,
  adult boolean NOT NULL,
  budget bigint NOT NULL,
  original_language text NOT NULL,
  original_title text NOT NULL,
  overview text NOT NULL,
  tmdb_popularity double precision NOT NULL,
  release_date date,
  revenue bigint,
  runtime bigint,
  status text NOT NULL,
  tagline text NOT NULL,
  title text NOT NULL,
  tmdb_vote_avg double precision NOT NULL,
  tmdb_vote_count bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT movie_pkey PRIMARY KEY (id)
);
CREATE TABLE public.movie_credits (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  movie_id bigint NOT NULL,
  person_id bigint NOT NULL,
  job_id bigint NOT NULL,
  title text,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  CONSTRAINT movie_credits_pkey PRIMARY KEY (id),
  CONSTRAINT movie_credits_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES public.movie(id),
  CONSTRAINT movie_credits_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id),
  CONSTRAINT movie_credits_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job(id)
);
CREATE TABLE public.movie_genre (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  movie_id bigint NOT NULL,
  genres_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  CONSTRAINT movie_genre_pkey PRIMARY KEY (id),
  CONSTRAINT movie_genre_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES public.movie(id),
  CONSTRAINT movie_genre_genres_id_fkey FOREIGN KEY (genres_id) REFERENCES public.genres(id)
);
CREATE TABLE public.person (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tmdb_id bigint NOT NULL,
  name text NOT NULL,
  adult boolean NOT NULL,
  biography text,
  birthday date,
  place_of_birth text,
  deathday date,
  gender bigint NOT NULL,
  popularity double precision NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  known_for_department bigint,
  profile_path text,
  CONSTRAINT person_pkey PRIMARY KEY (id)
);
CREATE TABLE public.person_aka (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  person_id bigint NOT NULL,
  nickname text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT person_aka_pkey PRIMARY KEY (id),
  CONSTRAINT person_aka_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id)
);
CREATE TABLE public.profile (
  id uuid NOT NULL,
  username text NOT NULL UNIQUE CHECK (length(username) < 50),
  date_of_birth date NOT NULL,
  is_adult boolean NOT NULL DEFAULT false,
  role bigint NOT NULL DEFAULT '0'::bigint,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  setting_display_adult_content boolean NOT NULL DEFAULT false,
  CONSTRAINT profile_pkey PRIMARY KEY (id),
  CONSTRAINT profile_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.script_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  script_name text NOT NULL,
  status text CHECK (status = ANY (ARRAY['success'::text, 'failure'::text])),
  batch_size integer,
  error_code text,
  error_detail text,
  started_at timestamp with time zone,
  finished_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  CONSTRAINT script_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.season (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tmdb_id bigint NOT NULL,
  show_id bigint NOT NULL,
  name text NOT NULL,
  season_number bigint NOT NULL,
  overview text NOT NULL,
  air_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT season_pkey PRIMARY KEY (id),
  CONSTRAINT season_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.show(id)
);
CREATE TABLE public.show (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tmdb_id bigint NOT NULL UNIQUE,
  adult boolean NOT NULL,
  episode_run_time bigint,
  first_air_date date NOT NULL,
  in_production boolean NOT NULL,
  last_air_date date,
  name text NOT NULL,
  number_of_episodes bigint NOT NULL,
  number_of_seasons bigint NOT NULL,
  original_language text NOT NULL,
  original_name text NOT NULL,
  overview text NOT NULL,
  tmdb_popularity double precision NOT NULL,
  status text NOT NULL,
  tagline text NOT NULL,
  type text NOT NULL,
  tmdb_vote_avg double precision NOT NULL,
  tmdb_vote_count bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT show_pkey PRIMARY KEY (id)
);
CREATE TABLE public.show_credits (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  show_id bigint NOT NULL,
  person_id bigint NOT NULL,
  job_id bigint NOT NULL,
  title text,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  CONSTRAINT show_credits_pkey PRIMARY KEY (id),
  CONSTRAINT show_credits_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id),
  CONSTRAINT show_credits_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job(id),
  CONSTRAINT show_credits_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.show(id)
);
CREATE TABLE public.show_genre (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  show_id bigint NOT NULL,
  genres_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  CONSTRAINT show_genre_pkey PRIMARY KEY (id),
  CONSTRAINT show_genre_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.show(id),
  CONSTRAINT show_genre_genres_id_fkey FOREIGN KEY (genres_id) REFERENCES public.genres(id)
);
CREATE TABLE public.user_followed_movies (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  movie_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  CONSTRAINT user_followed_movies_pkey PRIMARY KEY (id),
  CONSTRAINT user_followed_movies_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES public.movie(id),
  CONSTRAINT user_followed_movies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profile(id)
);
CREATE TABLE public.user_followed_shows (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  show_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  CONSTRAINT user_followed_shows_pkey PRIMARY KEY (id),
  CONSTRAINT user_followed_shows_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.show(id),
  CONSTRAINT user_followed_shows_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profile(id)
);
```

---

## Core Content Tables

### `movie`

Stores TMDB movie metadata: `adult`, `budget`, `original_language`, `original_title`, `overview`, `tmdb_popularity`, `release_date`, `revenue`, `runtime`, `status`, `tagline`, `title`, `tmdb_vote_avg`, `tmdb_vote_count` (string fields are `text` in the DDL).

- Primary key: `id` (`bigint`, identity)
- External source key: `tmdb_id` (unique)
- Soft delete support: `deleted_at`

### `show`

Stores TMDB TV show metadata: `adult`, `episode_run_time`, `first_air_date`, `in_production`, `last_air_date`, `name`, `number_of_episodes`, `number_of_seasons`, `original_language`, `original_name`, `overview`, `tmdb_popularity`, `status`, `tagline`, `type`, `tmdb_vote_avg`, `tmdb_vote_count`.

- Primary key: `id` (`bigint`, identity)
- Unique external source key: `tmdb_id` (unique constraint)

### `person`

Stores cast/crew person records from TMDB: `name`, `adult`, optional `biography` and `birthday`, optional `place_of_birth` and `deathday`, `gender`, `popularity`, optional `known_for_department` and `profile_path`.

- Primary key: `id` (`bigint`, identity)
- External source key: `tmdb_id` (required, `NOT NULL`)

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

One shared catalog table holds all TMDB genre rows:

- `genres` — `id` (`bigint`, identity), required `name` and `tmdb_id` (unique), `created_at` / `updated_at` / `deleted_at`

Join tables link content to that catalog (FK column name `genres_id` in both):

- `movie_genre` — `movie_id` → `movie.id`, `genres_id` → `genres.id`, `created_at` (UTC default per DDL)
- `show_genre` — `show_id` → `show.id`, `genres_id` → `genres.id`, `created_at` (UTC default per DDL)

So:

- `movie` many-to-many `genres` via `movie_genre`
- `show` many-to-many `genres` via `show_genre`

---

## User profile (`profile`)

Application-facing user record keyed by the same UUID as Supabase Auth.

- Primary key: `id` (`uuid`), foreign key `id -> auth.users(id)` (one row per auth user when present)
- `username` (`text`, unique, `CHECK (length(username) < 50)`), `date_of_birth`, `is_adult` (default `false`), `role` (default `0`)
- `setting_display_adult_content` (boolean, default `false`) — app preference for whether adult-labeled content may be shown
- `created_at`, optional `updated_at` / `deleted_at`

Follow tables reference `profile.id`, not `auth.users` directly.

---

## User Follow Tables

### `user_followed_movies`

Tracks movies a user follows.

- Primary key: `id` (`bigint`, identity)
- Foreign key: `user_id -> profile.id`
- Foreign key: `movie_id -> movie.id`
- `created_at` default: UTC expression `(now() AT TIME ZONE 'utc')`

### `user_followed_shows`

Tracks shows a user follows.

- Primary key: `id` (`bigint`, identity)
- Foreign key: `user_id -> profile.id`
- Foreign key: `show_id -> show.id`
- `created_at` default: same UTC expression as `user_followed_movies`

These tables are the personalization layer between `profile` and media entities.

---

## Script run logging (`script_logs`)

Stores outcomes for background scripts or ETL jobs (ingestion, backfills, etc.).

- Primary key: `id` (uuid, default `gen_random_uuid()`)
- `script_name` (required)
- `status` is nullable but constrained to `success` or `failure` when set
- Optional: `batch_size`, `error_code`, `error_detail`, `started_at`; `finished_at` defaults to `now()` in the DDL
- `created_at` with UTC default (ingestion/audit row time, distinct from `started_at` / `finished_at`)
- No foreign keys to content tables

RLS for `script_logs` is not listed in the inventory below; confirm in the Supabase dashboard for your environment.

---

## Cardinality Summary

- `department` 1 -> many `job`
- `show` 1 -> many `season`
- `season` 1 -> many `episode`
- `person` 1 -> many `person_aka`
- `movie` many-to-many `person` via `movie_credits` (+ `job`)
- `show` many-to-many `person` via `show_credits` (+ `job`)
- `episode` many-to-many `person` via `episode_credits` (+ `job`)
- `movie` many-to-many `genres` via `movie_genre`
- `show` many-to-many `genres` via `show_genre`
- `auth.users` 1 -> 0..1 `profile` (same UUID as `profile.id` when a profile row exists)
- `profile` 1 -> many rows in `user_followed_movies` and `user_followed_shows`
- `script_logs` is standalone (no inbound FKs from other public tables in this model)

---

## Current RLS Policies

From the provided policy export, the `public` schema currently uses the policies below.

### Read policies (applied to `anon`, `authenticated`)

- `department`: `public_read_department_select` (`SELECT`)
- `episode`: `public_read_episode_select` (`SELECT`)
- `episode_credits`: `public_read_episode_credits_select` (`SELECT`)
- `genres`: `public_read_genres_select` (`SELECT`)
- `job`: `public_read_job_select` (`SELECT`)
- `movie`: `public_read_movie_select` (`SELECT`)
- `movie_credits`: `public_read_movie_credits_select` (`SELECT`)
- `movie_genre`: `public_read_movie_genre_select` (`SELECT`)
- `person`: `public_read_person_select` (`SELECT`)
- `person_aka`: `public_read_person_aka_select` (`SELECT`)
- `season`: `public_read_season_select` (`SELECT`)
- `show`: `public_read_show_select` (`SELECT`)
- `show_credits`: `public_read_show_credits_select` (`SELECT`)
- `show_genre`: `public_read_show_genre_select` (`SELECT`)

All of the policies above use an always-true condition (equivalent to `USING (true)`), so reads are globally allowed for `anon` and `authenticated`.

### `profile` ownership policies (`authenticated` only)

- `profile_select_own` (`SELECT`) - only rows where `profile.id = auth.uid()`
- `profile_insert_own` (`INSERT`) - `WITH CHECK (id = auth.uid())`
- `profile_update_own` (`UPDATE`) - `USING (id = auth.uid())` and `WITH CHECK (id = auth.uid())`

No `DELETE` policy is listed for `profile` in the provided export.

### `script_logs` backend/admin policies

- `script_logs_insert_backend` (`INSERT`, role: `service_role`) - `WITH CHECK (true)`
- `script_logs_select_backend_and_admins` (`SELECT`, roles: `authenticated`, `service_role`)
  - access is allowed for `service_role`, and for authenticated users whose own `profile.role = 4` (admin role check in the policy expression)

No `UPDATE` or `DELETE` policy is listed for `script_logs` in the provided export.

### Follow-table ownership policies (`authenticated` only)

For `user_followed_movies`:

- `user_followed_movies_select_own` (`SELECT`) - `USING (user_id = auth.uid())`
- `user_followed_movies_insert_own` (`INSERT`) - `WITH CHECK (user_id = auth.uid())`
- `user_followed_movies_update_own` (`UPDATE`) - `USING (user_id = auth.uid())` and `WITH CHECK (user_id = auth.uid())`
- `user_followed_movies_delete_own` (`DELETE`) - `USING (user_id = auth.uid())`

For `user_followed_shows`:

- `user_followed_shows_select_own` (`SELECT`) - `USING (user_id = auth.uid())`
- `user_followed_shows_insert_own` (`INSERT`) - `WITH CHECK (user_id = auth.uid())`
- `user_followed_shows_update_own` (`UPDATE`) - `USING (user_id = auth.uid())` and `WITH CHECK (user_id = auth.uid())`
- `user_followed_shows_delete_own` (`DELETE`) - `USING (user_id = auth.uid())`

---

## Notes and Observations

- Timestamp defaults for `created_at` in this schema use `(now() AT TIME ZONE 'utc')` (including join and follow tables); `script_logs.finished_at` still defaults to plain `now()`.
- Soft-delete fields (`deleted_at`) exist on `genres` and other domain tables; they are absent on credit rows, genre join rows (`movie_genre`, `show_genre`), `script_logs`, and follow tables.
- `episode_credits`, `movie_credits`, and `show_credits` have `created_at` but no `updated_at` / `deleted_at` in this schema.
- `script_logs` includes `created_at` (UTC) in addition to `started_at` / `finished_at` for run timing.
- Constraint names are explicit and clear, which is helpful for migrations and debugging.

