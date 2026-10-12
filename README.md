# [watchpapa.tv](https://watchpapa.tv)

**Follow the movies and TV shows you care about, and see when new episodes and films actually come out, all in one calendar.**

![watchpapa.tv banner: the watchpapa logo on a dark background](public/readme%20assets/banner.png)

[![Website status](https://img.shields.io/website?url=https%3A%2F%2Fwatchpapa.tv&label=watchpapa.tv&up_message=online&down_message=offline)](https://watchpapa.tv)
[![Licence: all rights reserved](https://img.shields.io/badge/licence-all%20rights%20reserved-lightgrey)](LICENCE)
[![Data: TMDB](https://img.shields.io/badge/data-TMDB-01b4e4?logo=themoviedatabase&logoColor=white)](https://www.themoviedb.org/)

[![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers_%26_Pages-f38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![Hono 4](https://img.shields.io/badge/Hono-4-e36002?logo=hono&logoColor=white)](https://hono.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres_%2B_Auth-3fcf8e?logo=supabase&logoColor=white)](https://supabase.com/)

## Overview

Keeping up with shows is easy to lose track of. You binge a series, catch up, and then have to remember when the next episode is due, while a second show keeps releasing weekly on a different day. watchpapa.tv collects the release dates of everything you follow into one personal calendar. It also lets you rate, log and organise what you've watched. The movie and TV catalogue is read live from [TMDB](https://www.themoviedb.org/), so titles, dates and cast are never out of date.

**Status:** live in production at [watchpapa.tv](https://watchpapa.tv) and under active development.

## Key features

- **Releases calendar:** follow shows and movies and see every upcoming episode and premiere on one calendar (`/calendar`).
- **Ratings and watch history:** rate movies, shows, seasons and single episodes, log rewatches and see how your ratings change over time.
- **Watchlists:** keep several named lists and mark titles as watched.
- **Discovery:** search and browse the full TMDB catalogue, get personal recommendations and see where a title is streaming in your region and on your services.
- **Import:** bring your history over from a Letterboxd or watchpapa CSV. The import runs in the background, so you can close the tab.
- **Profiles:** public profiles with favourites, stats and shareable image cards.

## How it works

The React frontend and the API both run on Cloudflare. The API is a Cloudflare Worker that fetches movie and TV data from TMDB on demand and caches it at the edge. watchpapa stores only user data in Supabase (PostgreSQL + Auth): ratings, follows and watchlists, each keyed by TMDB ID. Row Level Security (RLS) makes sure users can only ever read and write their own rows.

```mermaid
flowchart LR
    B[Browser] -->|loads app| P[Frontend<br/>React on Cloudflare Pages]
    P -->|own user data, RLS-gated| S[(Supabase<br/>Postgres + Auth)]
    P -->|content + multi-table reads<br/>JWT bearer| W[Worker API<br/>Hono on Cloudflare Workers]
    W -->|live content, edge-cached| T[TMDB API v3]
    W -->|SQL via Hyperdrive| S
    C[Cron trigger<br/>every minute] -->|advances import jobs| W
```

The full architecture, with the reasoning behind each design decision, will be in `docs/concepts/architecture.md` _(coming soon)_. Until then, [CONTEXT.md](CONTEXT.md) is the reference.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4, hosted on Cloudflare Pages |
| API | Cloudflare Worker, [Hono](https://hono.dev/) 4 |
| Database | Supabase PostgreSQL, accessed through [postgres.js](https://github.com/porsager/postgres) over Cloudflare Hyperdrive (Worker) and `supabase-js` (Frontend) |
| Auth | Supabase Auth (email + OAuth); the Worker verifies JWTs locally with `jose` |
| Content | TMDB API v3, read live and never stored |
| Email | Supabase Auth SMTP via Resend |
| Backups | GitHub Actions nightly `pg_dump` → `age`-encrypted → private Cloudflare R2 bucket, 30-day retention ([`scripts/db-backup.sh`](scripts/db-backup.sh)) — Supabase runs on the Free plan |
| Tests | Vitest (Worker), `node --test` (RLS, unit, Playwright e2e, backup pipeline, live smoke) and pytest (environment checks) |
| Deployment | Cloudflare Pages and Workers Builds on push to `production` |

## Quick start

**You need:** Node.js 22, a [TMDB API key](https://www.themoviedb.org/settings/api), and the URL, publishable key and session-pooler connection string of a Supabase project that has the watchpapa schema.

1. Clone the repository and install the two app packages:

   ```bash
   git clone https://github.com/watchpapa/watchpapa.git
   cd watchpapa
   (cd worker && npm install) && (cd Frontend && npm install)
   ```

   Both installs should finish without errors. The root `package.json` is only needed for the RLS tests.

2. Create the local config files from the examples, then fill in your TMDB key and Supabase URL and key:

   ```bash
   cp worker/.dev.vars.example worker/.dev.vars   # TMDB_API_KEY_SECRET
   cp Frontend/.env.example Frontend/.env         # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
   ```

3. Start the Worker API. The database connection string goes in a shell variable, not in `.dev.vars`:

   ```bash
   export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://USER:PASS@HOST:5432/postgres?sslmode=require"
   cd worker && npm run dev
   ```

   Wrangler starts the API on `http://localhost:8787`.

4. In a second terminal, check that the API is running:

   ```bash
   curl http://localhost:8787/health
   ```

   Expected output: `{"status":"ok"}`

5. Start the frontend:

   ```bash
   cd Frontend && npm run dev
   ```

   Open `http://localhost:5173`. You should see the home page with live posters from TMDB. Vite proxies `/api` requests to the Worker, so you don't need to configure CORS locally.

To run the tests, use `cd worker && npm test` (unit tests) and `npm install && npm run test:rls` from the repository root (RLS policy tests; these need `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in a root `.env`).

The other root suites: `npm run test:unit` (breached-password check), `npm run test:e2e` (Playwright against the real UI with all network mocked; first run `cd Frontend && npx playwright install chromium`), `npm run test:backup` (backup pipeline with a restore drill; needs Docker and [`age`](https://github.com/FiloSottile/age)) and `npm run test:smoke` (live Supabase + Worker; creates and deletes one throwaway user).

A step-by-step setup guide with troubleshooting will be in `docs/tutorials/getting-started.md` _(coming soon)_.

## Project structure

```text
watchpapa/
├── Frontend/                 # React app (Cloudflare Pages)
│   ├── src/pages/            #   one component per route: app/, auth/, admin/
│   ├── src/features/         #   data hooks grouped by domain (content, rating, follows, …)
│   ├── src/components/       #   shared UI components
│   └── src/lib/              #   small helpers: API client, Supabase client, TMDB image URLs
├── worker/                   # Cloudflare Worker API (Hono)
│   ├── src/routes/           #   one file per route group, admin routes in routes/admin/
│   ├── src/tmdb/             #   TMDB client, response normalisation, NSFW filtering
│   ├── src/import/           #   CSV import: resolve titles, commit rows
│   ├── test/                 #   Vitest unit tests
│   └── wrangler.jsonc        #   Worker config: bindings, vars, cron trigger, routes
├── Backend/src/db/migrations/  # numbered SQL migrations (append-only)
├── tests/                    # RLS policy tests (node --test) and environment checks (pytest)
├── Documentation/            # feature docs and release notes
├── public/                   # logos and README images
├── .github/workflows/        # manual fallback for deploying the Worker
└── CONTEXT.md                # detailed codebase reference: routes, schema, conventions
```

## Documentation

| I want to… | Read |
|---|---|
| Look up any route, table or convention right now | [CONTEXT.md](CONTEXT.md) |
| See what shipped in each release | [Documentation/releases.md](Documentation/releases.md) |
| Understand the announcements (`/updates`) system | [Documentation/announcements_system.md](Documentation/announcements_system.md) |
| Set up the project from scratch | Getting started _(coming soon)_ |
| Understand how the system fits together | Architecture _(coming soon)_ |
| Make my first change end to end | First feature tutorial _(coming soon)_ |
| Do one specific task (add a migration, add a route, …) | How-to guides _(coming soon)_ |
| Call the Worker API | API reference _(coming soon)_ |
| See what data is stored and who can access it | Data reference _(coming soon)_ |
| Look up an environment variable, script or config setting | Configuration reference _(coming soon)_ |
| Look up a term | Glossary _(coming soon)_ |

## Contributing

watchpapa.tv is a personal project under an all-rights-reserved licence, so outside contributions are not accepted without prior written permission. If you'd like to help, get in touch through the [contact page](https://watchpapa.tv/contact) first. The contributor workflow will be described in `CONTRIBUTING.md` _(coming soon)_.

## Licence

Copyright © 2026 Krzysztof Durski. All rights reserved. See [LICENCE](LICENCE).

## Acknowledgements

- Movie, TV and people data and images come from [TMDB](https://www.themoviedb.org/). _This product uses the TMDB API but is not endorsed or certified by TMDB._
- Streaming availability ("Where to watch") data is provided by [JustWatch](https://www.justwatch.com/) through TMDB.
- Built with [Cloudflare Workers and Pages](https://developers.cloudflare.com/), [Supabase](https://supabase.com/), [Hono](https://hono.dev/) and [React](https://react.dev/).

## AI usage

This project was built with AI assistance (Cursor and Claude Code) for brainstorming, implementation, debugging and documentation. The author made the architecture, planning and technical decisions and reviewed and adapted all AI output before it was committed. AI-assisted commits carry a `Co-authored-by` trailer naming the tool.
