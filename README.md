# [watchpapa.tv](https://watchpapa.tv)

![watchpapa banner](public/readme%20assets/banner.png)

> Note: The description below reflects the current MVP scope.

## 📚 Table of Contents

- [What is it?](#what-is-it)
- [Scenario](#scenario)
- [Use cases](#use-cases)
- [MVP Tech Stack](#mvp-tech-stack)
- [TMDB Ingestion Model (MVP)](#tmdb-ingestion-model-mvp)
- [Image Delivery (MVP)](#image-delivery-mvp)
- [Security (MVP)](#security-mvp)
- [Database (MVP)](#database-mvp)
  - [ER diagram](#er-diagram)
  - [List of DB related tools](#db-related-tools)
  - [Current performance level (MVP)](#db-performance-mvp)
  - [Amount of data](#db-amount-of-data)
  - [List of all methods/queries](#db-methods-and-queries)
  - [Example of how queries are implemented](#db-query-examples)
  - [Data integrity and scaling considerations](#data-integrity-and-scaling)
- [Future Features (Post-MVP)](#future-features-post-mvp)
- [Setup & Installation](#setup-and-installation)
- [AI Usage Note](#ai-usage-note)

## ❓ What is it?

watchpapa.tv is a web application that lets you track the release dates of episodes of shows you're watching or waiting for, as well as movie releases.

## 📺 Scenario

You just found a series "A" you like and have finished all available episodes, but you know new episodes are still coming out, and you want to keep watching. You're also watching series "B" that comes out weekly.

Thanks to watchpapa.tv, you can follow those series and track upcoming release dates in one place, so you never miss a new episode.

## 📋 Use cases

**Viewers & fans**

- **Track TV releases** — Follow shows and see when new episodes air so you keep up after catching up or while a series is ongoing (including weekly cadence).
- **Track movie releases** — Follow movies and monitor upcoming release-oriented information alongside your shows.
- **Unified timeline** — See upcoming releases from what you follow in one place via the in-app releases calendar (`/calendar`).
- **Discover catalog content** — Use search (local catalog with TMDB-backed discovery) plus browse-oriented listings for movies, shows, and people.
- **Deep-dive titles** — Open movie, show (with seasons/episodes), and person detail pages to explore cast and metadata.
- **TMDB shortcuts** — Open or share URLs keyed by TMDB IDs (`/movies/tmdb/:tmdbId`, `/shows/tmdb/:tmdbId`, `/people/tmdb/:tmdbId`) so a title resolves into app’s canonical record.
- **Adult-oriented content preference** — Control whether mature-rated titles (fro now only the ones that are flagged by TMDB as `Adult`) surface in browsing (profile-driven visibility).

**Accounts & onboarding**

- **Sign up / sign in** — Register and authenticate with Supabase Auth (including email verification flow).
- **Recover access** — Use forgot-password and reset-password flows.
- **Profile setup** — Complete a unique username after registration before using protected areas of the app.
- **Consent & notices** — Accept or manage cookie/consent banners where applicable; read static policies (About, Help, Terms, Privacy, Contact).

**Backend operators & integrations**

- **Populate catalog from TMDB** — Run scripted jobs that ingest popular/top-rated movies, shows, people, genres, jobs/departments, and related credits (within API rate limits).
- **Keep data fresh** — Run daily freshness jobs that refresh entities TMDB marks as changed, scoped to IDs already stored locally.
- **On-demand ingestion** — When search or navigation surfaces something not yet stored, resolve endpoints upsert by `tmdb_id` and enqueue background ingestion for a full refresh.
- **Authorized maintenance APIs** — Use authenticated mutate endpoints (for example `/api/inject`, `/api/resolve`) guarded by quotas and auditing for operational or product-driven sync.

## 🏗️ MVP Tech Stack

- Frontend: React + Vite + React Router
- Backend/API: Node.js + Express
- Database: Supabase PostgreSQL (via Sequelize + `pg`)
- Auth: Supabase Auth (OTP/JWT)
- Email: Supabase Auth email verification flow (SMTP: Resend)
- Scheduling: Script-based jobs (invoked via npm scripts / external scheduler)

## 💉 TMDB Ingestion Model (MVP)

1. Daily popular sync:
  - Run popular/top-rated loaders for movies, shows, and people (configurable `--limit`).
  - For each candidate TMDB ID, insert only if it does not already exist locally.
  - New records are ingested with related details (for example: credits, genres, seasons/episodes where relevant).
2. Daily freshness sync:
  - Fetch TMDB "changed in window" IDs (default last 24h, optional start/end date overrides).
  - Intersect that set with IDs already stored locally, then refresh only matched records.
  - Use scoped/targeted refresh when possible (full refresh only when required by detected changes).
3. On-demand search fallback:
  - Search requests query TMDB directly for live discovery.
  - Resolve requests upsert missing TMDB IDs into local tables and return a local ID immediately.
  - After resolve, a deduplicated background ingestion runs to perform a full refresh of that entity.

## 🏞️ Image Delivery (MVP)

- Poster/backdrop images are loaded directly from TMDB CDN URLs.
- For MVP, binaries are not stored in project storage to reduce storage costs.
- Database records store TMDB image path metadata only (for example: `poster_path`, `backdrop_path`, `profile_path`).

## ++[🔒 Security (MVP)](Documentation/security_info.md)++

## ++[🗄️ Database (MVP)](Documentation/database_info.md)++

The MVP uses a relational PostgreSQL schema (Supabase) designed around users, follows, media entities, and release-related details.

### 🗺️ ER diagram

![watchpapa.tv MVP ER diagram](public/readme%20assets/watchpapa.tv%20-%20MVP%20ER.png)

### 🛠️ List of DB related tools

- **Supabase PostgreSQL** - managed Postgres database used by the MVP.
- **Sequelize** - ORM layer used by the backend for models and queries.
- **pg** - PostgreSQL driver used by Sequelize for DB connections.
- **Supabase Dashboard / SQL Editor** - schema inspection, SQL execution, and operational checks.
- **npm seed scripts** - TMDB ingestion/update scripts that populate and refresh database data.

### 📈 Current performance level (MVP):

- Main bottleneck: TMDB API **~40 calls/sec** rate limit.
- With the current data volume (see section below), performance is in a **good MVP range** for expected traffic.
- Main user-facing reads are currently index-backed and complete without noticeable delay in normal usage.
- Daily ingestion/update jobs complete reliably on schedule without blocking user-facing API traffic.
- This is an MVP baseline (not a formal load-test benchmark); dedicated stress testing is planned for post-MVP scaling.

### 📊 Amount of data:

- **Movies** ~200 rows
  - **Movie credits** ~28k rows
- **Shows** ~200 rows
  - **Show credits** 5k rows
- **Seasons** ~1.3k rows
- **Episodes** ~50k rows
  - **Episode credits** ~630k rows
- **People** ~100k rows

### 🔠 List of all methods/queries:

- **Search (`GET /api/search`)**
  - `movie`: `ILIKE` on `title` / `original_title`, ordered by `tmdb_popularity`.
  - `show`: `ILIKE` on `name` / `original_name`, ordered by `tmdb_popularity`.
  - `person`: `ILIKE` on `person.name` + `person_aka.nickname` with dedup (`DISTINCT ON`).
- **Resolve (`POST /api/resolve`)**
  - Fast existence check by `tmdb_id` (`movie` / `show` / `person`).
  - Upsert by `tmdb_id` when entity is missing.
  - Returns local DB `id` immediately; full ingest continues in background.
- **Movie ingest (`inject_movie`)**
  - Upsert `movie` by `tmdb_id`.
  - Replace/sync `movie_genre` links.
  - Replace `movie_credits`.
  - Batch person resolution (`SELECT ... IN (...)` + bulk insert new `person` / `person_aka`).
  - Job resolution (`resolve_job`) and bulk insert into `movie_credits`.
  - Insert run metadata into `script_logs`.
- **TV show ingest (`inject_tv_show`)**
  - Upsert `show` by `tmdb_id`.
  - Replace/sync `show_genre` links.
  - Upsert `season` and `episode` by `tmdb_id`.
  - Replace `episode_credits` per episode.
  - Batch person resolution + bulk episode credit insert.
  - Insert run metadata into `script_logs`.
- **Person ingest (`inject_person`)**
  - Upsert `person` by `tmdb_id`.
  - Department lookup / resolve.
  - Sync `person_aka` aliases (insert/restore/soft-delete delta).
  - Insert run metadata into `script_logs`.
- **Operational / support DB flows**
  - Popularity refresh scripts: bulk `UPDATE` of `tmdb_popularity`.
  - Changed-entity scripts: fetch changed TMDB IDs, then refresh only matching local entities.
  - Follow/unfollow flows: insert/delete in `user_followed_movies` and `user_followed_shows` (unique pair constraints).
  - Profile/auth-linked reads/writes: `profile` row lifecycle and username uniqueness checks.

### 🤷 Example of how are queries implemented

Below are simplified examples matching the current backend approach:

**1) Search query (indexed `ILIKE` + ordering):**

```sql
SELECT id, tmdb_id, title, original_title, tmdb_popularity
FROM movie
WHERE deleted_at IS NULL
  AND (title ILIKE :pattern OR original_title ILIKE :pattern)
ORDER BY tmdb_popularity DESC
LIMIT :limit;
```

**2) Upsert by `tmdb_id` (insert-or-update):**

```sql
INSERT INTO show (tmdb_id, name, overview, tmdb_popularity)
VALUES (:tmdbId, :name, :overview, :popularity)
ON CONFLICT (tmdb_id) DO UPDATE SET
  name = EXCLUDED.name,
  overview = EXCLUDED.overview,
  tmdb_popularity = EXCLUDED.tmdb_popularity,
  updated_at = now()
RETURNING id;
```

**3) Full-refresh credits pattern (replace snapshot):**

```sql
DELETE FROM episode_credits
WHERE episode_id = :episodeId;

INSERT INTO episode_credits (episode_id, person_id, job_id, title)
VALUES
  (:episodeId, :personId1, :jobId1, :title1),
  (:episodeId, :personId2, :jobId2, :title2);
```

In code, these are executed as parameterized SQL via `sequelize.query(...)` inside transactions for ingest flows.

### 🩺 Data integrity and scaling considerations

- **Transactions**
  - Multi-step ingest flows (`show`/`season`/`episode`/`credits`) run inside a single DB transaction.
  - On failure, the flow is rolled back, preventing partial writes across related tables.
- **Indexing strategy**
  - Primary/unique indexes back identity and upsert paths (for example `tmdb_id`, composite follow constraints).
  - B-tree indexes support joins and timeline filters.
  - Trigram GIN indexes support fast `ILIKE` search on titles/names.
- **ORM usage pattern (Sequelize in this project)**
  - Sequelize is used mainly as a DB driver + transaction manager through `sequelize.query(...)`.
  - Most data access is handwritten SQL (parameterized), not model-centric ORM CRUD.
  - This hybrid pattern keeps SQL explicit while still using Sequelize connection/transaction utilities.
- **Data validation**
  - Input validation happens in API/service logic before DB writes (type checks, required fields, normalization).
  - DB-level constraints (PK/FK/UNIQUE/NOT NULL where defined) provide a second safety layer.
  - Ingest scripts normalize external TMDB payloads before persistence.
- **Normalization (schema design)**
  - Core entities are split into dedicated tables (`movie`, `show`, `season`, `episode`, `person`, `genres`) with bridge tables for many-to-many relations (`movie_genre`, `show_genre`, credits tables, follow tables).
  - Repeating groups are separated into child tables (for example episode/show/movie credits, person aliases), which reduces duplication and update anomalies.
  - Practical classification: the schema is **mostly in Third Normal Form (3NF)** for core transactional data (keys define rows; non-key attributes depend on the key, not other non-key attributes).
  - Some denormalized/derived fields are intentionally kept for performance and product needs (for example popularity/ranking style attributes), which is a common trade-off and does not change the core design being 3NF-oriented.
- **ACID properties (PostgreSQL + transactional writes)**
  - **Atomicity:** grouped ingest statements commit together or not at all.
  - **Consistency:** schema constraints and FK relations protect referential integrity.
  - **Isolation:** concurrent operations rely on PostgreSQL transaction isolation guarantees.
  - **Durability:** committed writes are durable in managed Supabase Postgres storage.
- **Scalability considerations (MVP -> growth)**
  - Current design scales well for MVP read-heavy traffic due to targeted indexes and query shaping.
  - Ingestion is batched and deduplicated to reduce query count and lock pressure.
  - Future scaling path: deeper load testing, hot-query tuning, optional read replicas/caching, and partitioning strategies for very large credits/event-style tables.

## 🔮 Future Features (Post-MVP)

- External calendar sync with Google Calendar and Apple Calendar (the internal in-app calendar remains available in MVP).
- More strict adult preference setting - considering certifications.
- Complete footer sites.
- Connect email account with OAuth.

## 🛠 Setup & Installation

### 1) Prerequisites

- Node.js 20+ and npm
- Supabase PostgreSQL database
- TMDB API key

### 2) Clone and install dependencies

```bash
git clone https://github.com/<your-user>/watchpapa.git
cd watchpapa
npm install
cd Frontend && npm install && cd ..
```

### 3) Configure environment variables

Create a root `.env` file (backend) with:

- `DATABASE_URL`
- `TMDB_API_KEY_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS` (optional, comma-separated; defaults to local Vite origins)
- `PORT` (optional, defaults to `3000`)

Frontend (`Frontend/.env`) variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)

### 4) Run the app locally

Start backend (from project root):

```bash
npm run dev
```

Start frontend (in a second terminal):

```bash
cd Frontend
npm run dev
```

Default local URLs:

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`

### 5) Optional: seed / refresh TMDB data

```bash
npm run seed:tmdb:genres
npm run seed:tmdb:jobs
npm run seed:tmdb:popular-movies-today
npm run seed:tmdb:popular-shows-today
npm run seed:tmdb:popular-people-today
```

For the complete list of scripts (including changed-window refresh, top-rated loaders, popularity updates, and one-off utilities), see `Documentation/scripts_to_run.md`.

>All changed/popularity scripts are not yet 100% ready (current stage is mostly AIed proof of concept)

### 6) Tests

```bash
npm run test:injections
```

## 🤖 AI Usage Note

This project was developed with AI-assisted support across brainstorming, implementation, debugging, and documentation tasks. All outputs were reviewed and adapted by the author before being included in the project.

This project was **not** vibe-coded. The architecture, planning, and technical decisions were made by the author; AI was used as an assistive tool during implementation, refining and documentation.

Most commits were created in Cursor using the prompt "Make atomic commits"
