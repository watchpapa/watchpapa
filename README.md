# [watchpapa.tv](https://watchpapa.tv)

![watchpapa banner](public/readme%20assets/banner.png)

> Note: The description below reflects the current MVP scope.

## ❓ What is it?

Watchpapa.tv is a web application that lets you track the release dates of episodes of shows you're watching or waiting for, as well as movie releases.

## 📺 Scenario

You just found a series "A" you like and have finished all available episodes, but you know new episodes are still coming out, and you want to keep watching. You're also watching series "B" that comes out weekly.

Thanks to watchpapa.tv, you can follow those series and track upcoming release dates in one place, so you never miss a new episode.

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

## 🗄️ Database (MVP)

The MVP uses a relational PostgreSQL schema (Supabase) designed around users, follows, media entities, and release-related details.

![watchpapa MVP ER diagram](public/readme%20assets/watchpapa.tv%20-%20MVP%20ER.png)

## 🔮 Future Features (Post-MVP)

- External calendar sync with Google Calendar and Apple Calendar (the internal in-app calendar remains available in MVP).

## 🤖 AI Usage Note

This project was developed with AI-assisted support across brainstorming, implementation, debugging, and documentation tasks. All outputs were reviewed and adapted by the author before being included in the project.

This project was **not** vibe-coded. The architecture, planning, and technical decisions were made by the author; AI was used as an assistive tool during implementation and documentation.


