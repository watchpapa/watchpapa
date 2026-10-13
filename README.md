<div align="center">

<a href="https://watchpapa.tv"><img src="public/readme%20assets/banner.png" alt="watchpapa.tv" width="560"></a>

### Never miss a release again.

**Follow the movies and shows you care about, see every upcoming episode and premiere on one calendar,<br>and keep a rating diary of everything you've watched.**

[![Website status](https://img.shields.io/website?url=https%3A%2F%2Fwatchpapa.tv&label=watchpapa.tv&up_message=online&down_message=offline&style=flat-square)](https://watchpapa.tv)
[![Data: TMDB](https://img.shields.io/badge/data-TMDB-01b4e4?logo=themoviedatabase&logoColor=white&style=flat-square)](https://www.themoviedb.org/)
[![Licence: all rights reserved](https://img.shields.io/badge/licence-all%20rights%20reserved-lightgrey?style=flat-square)](LICENCE)

[![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black&style=flat-square)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white&style=flat-square)](https://vite.dev/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white&style=flat-square)](https://tailwindcss.com/)
[![Cloudflare Workers & Pages](https://img.shields.io/badge/Cloudflare-Workers_%26_Pages-f38020?logo=cloudflare&logoColor=white&style=flat-square)](https://developers.cloudflare.com/workers/)
[![Hono 4](https://img.shields.io/badge/Hono-4-e36002?logo=hono&logoColor=white&style=flat-square)](https://hono.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres_%2B_Auth-3fcf8e?logo=supabase&logoColor=white&style=flat-square)](https://supabase.com/)

**[Live site](https://watchpapa.tv)** · **[Features](#features)** · **[How it works](#how-it-works)** · **[Engineering highlights](#engineering-highlights)** · **[Quick start](#quick-start)** · **[Documentation](#documentation)**

<br>

<img src="Documentation/images/readme/home.webp" alt="The watchpapa.tv home page: a trending hero banner above rows of popular movies and shows" width="100%">

</div>

<br>

## Why watchpapa?

Keeping up with shows is easy to lose track of. You binge a series, catch up, and then have to remember when the next episode is due, while a second show keeps releasing weekly on a different day, and a film you care about is "coming this autumn".

watchpapa collects the release dates of everything you follow into **one personal calendar**, and doubles as a place to **rate, log and organise** what you've watched. The movie and TV catalogue is read **live from [TMDB](https://www.themoviedb.org/)**, so titles, dates, posters and cast are never out of date. watchpapa itself stores only *your* data.

**Status:** live in production at [watchpapa.tv](https://watchpapa.tv) and under active development.

## Features

### 📅 A calendar of everything you follow

Follow shows and movies and see every upcoming episode and premiere in one place. Desktop gets a month grid with today highlighted; on a phone you can switch between an agenda list and a week view. Titles that can no longer release (a finished show, an already-released film) can't be newly followed, so the calendar only ever shows things worth waiting for.

<div align="center">
<img src="Documentation/images/readme/calendar.webp" alt="Releases calendar for October 2026 with followed shows and movies on their air dates and a followed-titles sidebar" width="100%">
</div>

<sub>Screenshots of signed-in screens show a demo account with real TMDB titles.</sub>

### 🎬 Detail pages that do the work

Every movie, show, season, episode and person has its own page: rate it, log a watch (or several, as a rewatch diary), add it to a watchlist, and see **where to stream it** in the countries you pick, powered by JustWatch data. Community ratings appear once ten people have rated a title (until then you see TMDB's average), your own rating keeps a history, and a share button generates image cards for stories, posts or chats.

<div align="center">
<img src="Documentation/images/readme/movie.webp" alt="The Matrix detail page with overview, genres, a Where to watch panel and a rating and watchlist sidebar" width="100%">
</div>

### 🔎 Discovery

- **Search** across movies, shows and people in one relevance-ranked list, with type filters and sorting.
- **Popular** is backed by TMDB's daily trending feed, so it really changes every day. Genre rows and "coming soon" shelves sit alongside it.
- **Suggested for you** learns from your ratings and watched titles and blends them with what is currently popular in your genres, with endless scroll.
- **My Services** (Pro and above) filters Popular, Top rated and Suggested down to the streaming services you actually pay for.
- **Collections**, per-person **filmographies** you can sort and filter, and age **certifications** with a per-country lookup.

<div align="center">
<img src="Documentation/images/readme/search.webp" alt="Search results for 'blade runner' with Movies, Shows and People tabs, sorting and follow buttons" width="100%">
</div>

### 👤 Your library, profile and people

Keep several named **watchlists** (rating a title or logging a watch takes it off the list for you), pin five **favourites**, choose a banner and avatar, and share a profile card. Observe friends to get an **activity feed** and see their ratings on the titles you're looking at; private accounts, blocking and notifications are built in.

<div align="center">
<img src="Documentation/images/readme/profile.webp" alt="A profile page with banner, bio, observers and observing counts, five favourites and rating statistics" width="100%">
<br><br>
<img src="Documentation/images/readme/watchlists.webp" alt="The My Watchlists page with two lists and a poster grid with Watched buttons" width="100%">
</div>

### 📱 Built for phones as well

A bottom tab bar, a drawer with every destination, an agenda-style calendar and detail pages that reflow instead of shrinking. Pro accounts can swap the middle tab for My Services.

<div align="center">
<table>
<tr>
<td><img src="Documentation/images/readme/mobile-home.webp" alt="Home page on a phone" width="260"></td>
<td><img src="Documentation/images/readme/mobile-movie.webp" alt="A movie page on a phone with the rating panel and action buttons" width="260"></td>
<td><img src="Documentation/images/readme/mobile-calendar.webp" alt="The calendar on a phone in agenda view" width="260"></td>
</tr>
</table>
</div>

### And the rest

| | |
|---|---|
| **Import / export** | Bring your history over from a Letterboxd or watchpapa CSV. The import runs in the background, so you can close the tab. Export everything as CSV any time. |
| **Language and region** | Choose a content language, show titles translated or in their original language, and pick the regions that drive release dates and "Where to watch". |
| **Home page your way** | Reorder or hide any row on the home page. |
| **Adult content is opt-in** | Off by default and gated by date of birth, with filtering that goes beyond TMDB's own flag, poster blurring and a separate, optional Adult tab. |
| **Plans and rewards** | Free, Premium, Pro and Pro+ plans, lifetime Premium for the first 5,000 early adopters, referrals, reward codes and admin-granted upgrades. No payments are wired up yet. |
| **Announcements** | An in-app `/updates` feed written by staff in a rich-text editor. |

## How it works

The React frontend and the API both run on Cloudflare. The API is a Cloudflare Worker that reads movie and TV data from TMDB on demand and caches it at the edge. watchpapa stores only user data in Supabase (PostgreSQL + Auth): ratings, follows and watchlists, each keyed by TMDB id. Row Level Security (RLS) means users can only ever read and write their own rows.

```mermaid
flowchart LR
    B([Browser]) -->|loads app| P["Frontend<br/>React on Cloudflare Pages"]
    X([Social / chat crawlers]) -->|link previews| F["Pages Function<br/>real 404s + OG / JSON-LD tags"]
    F -->|GET /api/meta| W
    P -->|own user data, RLS-gated| S[("Supabase<br/>Postgres + Auth")]
    P -->|content + multi-table reads<br/>JWT bearer| W["Worker API<br/>Hono on Cloudflare Workers"]
    W -->|live content, edge-cached| T[TMDB API v3]
    W -->|SQL via Hyperdrive| S
    C[Cron trigger<br/>every minute] -->|advances import jobs| W
    G["GitHub Actions<br/>nightly"] -->|pg_dump, age-encrypted| R[("Cloudflare R2<br/>30-day retention")]
    S -.-> G
```

<details>
<summary><b>What happens when someone opens a movie page</b></summary>

<br>

```mermaid
sequenceDiagram
    participant U as Browser
    participant W as Worker
    participant E as Edge cache
    participant T as TMDB
    U->>W: GET /api/content/movie/603?lang=en-US&region=US
    W->>E: fetch TMDB URL (cacheEverything, TTL 6h to 7d)
    alt cache hit
        E-->>W: cached JSON
    else cache miss
        E->>T: GET /movie/603 + credits, release dates, watch providers
        T-->>E: JSON
        E-->>W: JSON (now cached)
    end
    W->>W: normalise: UI field names, regional release date, certification, NSFW flag
    W-->>U: JSON (locale is part of the URL, so caches never mix languages)
    U->>U: user data (rating, watchlist, follows) comes straight from Supabase under RLS
```

</details>

## Engineering highlights

- **No content database.** Movies, shows, seasons, episodes, people and credits are fetched live from TMDB by the Worker and normalised into the shape the UI reads. Language and region travel as query parameters, so Cloudflare's edge cache partitions itself correctly with no extra work.
- **Designed for the Workers Free plan.** One request gets 50 subrequests and 10 ms of CPU, so every fan-out endpoint (card hydration, calendar releases, recommendations, sitemaps) is bounded by a configurable cap, and recommendations are budgeted down to the subrequest.
- **Stateless auth.** The Worker verifies Supabase JWTs locally against the project's JWKS (`jose`, ES256), with no per-request call to Supabase. Roles are read from the database on each request, never trusted from the token.
- **Database-enforced rules.** RLS on every table; plan limits (follows, watchlists, avatar upload, streaming-service selection) are enforced by triggers, not just by the UI. Worker mutations are audited by middleware and user-data writes by DB triggers.
- **Background import without Durable Objects.** CSV imports are a job queue advanced by a once-a-minute Cron Trigger, committing each chunk as it resolves, so progress is real and survives closing the tab.
- **Edge SEO.** A Pages Function returns real HTTP 404s and rewrites the SPA shell with per-title title, description, Open Graph tags and JSON-LD before it reaches crawlers that never run JavaScript.
- **Operational safety on a free database.** Nightly `pg_dump`, `age`-encrypted on the runner and stored in a private R2 bucket, with a restore drill covered by automated tests. New passwords are checked against known breaches in the browser using HIBP's k-anonymity API.
- **Tested at several levels.** 100+ Worker unit tests; RLS and audit-trigger tests against a live database inside rolled-back transactions; Playwright end-to-end tests with all network mocked; backup and restore tests on a real Postgres in Docker; a live smoke test.

The reasoning behind each of these is written up in [CONTEXT.md](CONTEXT.md), and the security model in [Documentation/security/security.md](Documentation/security/security.md).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4, hosted on Cloudflare Pages |
| Edge | Cloudflare Pages Function (404s, link previews, JSON-LD) |
| API | Cloudflare Worker, [Hono](https://hono.dev/) 4, plain JavaScript (ESM) |
| Database | Supabase PostgreSQL, accessed through [postgres.js](https://github.com/porsager/postgres) over Cloudflare Hyperdrive (Worker) and `supabase-js` (Frontend) |
| Auth | Supabase Auth (email + OAuth); the Worker verifies JWTs locally with `jose` |
| Content | TMDB API v3, read live and never stored |
| Email | Supabase Auth SMTP via Resend |
| Backups | GitHub Actions nightly `pg_dump` → `age`-encrypted → private Cloudflare R2 bucket, 30-day retention ([`scripts/db-backup.sh`](scripts/db-backup.sh)). Supabase runs on the Free plan |
| Tests | Vitest (Worker), `node --test` (RLS, unit, Playwright e2e, backup pipeline, live smoke) and pytest (environment checks) |
| Deployment | Cloudflare Pages and Workers Builds on push to `production` |

## Quick start

**You need:** Node.js 22, a [TMDB API key](https://www.themoviedb.org/settings/api), and the URL, publishable key and session-pooler connection string of a Supabase project that has the watchpapa schema (the migrations are in [`Backend/src/db/migrations/`](Backend/src/db/migrations/)).

1. Clone the repository and install the two app packages:

   ```bash
   git clone https://github.com/watchpapa/watchpapa.git
   cd watchpapa
   (cd worker && npm install) && (cd Frontend && npm install)
   ```

   Both installs should finish without errors. The root `package.json` is only needed for the root test suites.

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

### Running the tests

```bash
cd worker && npm test                 # Worker unit tests (Vitest)

npm install                           # once, from the repository root
npm run test:rls                      # RLS policy + audit trigger tests; need DATABASE_URL, SUPABASE_URL and
                                      #   SUPABASE_SERVICE_ROLE_KEY in a root .env
npm run test:unit                     # breached-password check and password-write guard
npm run test:e2e                      # Playwright against the real UI, all network mocked
                                      #   (first: cd Frontend && npx playwright install chromium)
npm run test:backup                   # backup pipeline incl. a restore drill (needs Docker and `age`)
npm run test:smoke                    # live Supabase + Worker; creates and deletes one throwaway user
```

Deployment, secrets, backups and restore are covered in [Documentation/deployment.md](Documentation/deployment.md).

<details>
<summary><b>Regenerating the screenshots in this README</b></summary>

<br>

The images in `Documentation/images/readme/` come from [`Frontend/scripts/readme-shots.mjs`](Frontend/scripts/readme-shots.mjs). Public pages are the real site, signed out. The signed-in screens use a **demo account**: every Supabase request is intercepted and answered with fixture data (real TMDB ids), so nothing is read from or written to the real database, while titles, posters and episode dates still come live from the API.

```bash
cd Frontend
VITE_API_BASE_URL=https://api.watchpapa.tv npx vite --port 5173 &   # port must be 5173 or 4173 (the Worker's CORS list)
node scripts/readme-shots.mjs                                        # writes WebP files to ../Documentation/images/readme
```

</details>

## Project structure

```text
watchpapa/
├── Frontend/                 # React app (Cloudflare Pages)
│   ├── functions/            #   Pages Function: real 404s + link-preview/JSON-LD injection
│   ├── src/pages/            #   one component per route: app/, auth/, admin/
│   ├── src/features/         #   data hooks grouped by domain (content, rating, follows, …)
│   ├── src/components/       #   shared UI components
│   ├── src/lib/              #   small helpers: API client, Supabase client, TMDB image URLs
│   └── scripts/              #   asset generators and the README screenshot script
├── worker/                   # Cloudflare Worker API (Hono)
│   ├── src/routes/           #   one file per route group, admin routes in routes/admin/
│   ├── src/tmdb/             #   TMDB client, response normalisation, recommendations, NSFW filtering
│   ├── src/import/           #   CSV import: resolve titles, commit rows
│   ├── test/                 #   Vitest unit tests
│   └── wrangler.jsonc        #   Worker config: bindings, vars, cron trigger, routes
├── Backend/src/db/migrations/  # numbered SQL migrations (append-only)
├── scripts/db-backup.sh      # nightly encrypted database backup pipeline
├── tests/                    # node --test suites (rls_tests, unit, e2e, backup, smoke) and pytest environment checks
├── Documentation/            # all project docs: release notes, deployment, database, security, compliance (see its README)
├── public/                   # logos and README images
├── .github/workflows/        # nightly database backup, plus a manual fallback for deploying the Worker
└── CONTEXT.md                # detailed codebase reference: routes, schema, conventions
```

## Documentation

| I want to… | Read |
|---|---|
| Look up any route, table or convention right now | [CONTEXT.md](CONTEXT.md) |
| Deploy, configure secrets, restore a backup | [Documentation/deployment.md](Documentation/deployment.md) |
| See what shipped in each release | [Documentation/releases.md](Documentation/releases.md) |
| See the database tables, policies and functions | [Documentation/database/schema.md](Documentation/database/schema.md) |
| Understand how plans, referrals and reward codes work | [Documentation/subscription_system.md](Documentation/subscription_system.md) |
| Understand the announcements (`/updates`) system | [Documentation/announcements_system.md](Documentation/announcements_system.md) |
| Review the threat model and security controls | [Documentation/security/security.md](Documentation/security/security.md) |
| Find the GDPR records, breach plan and request SOP | [Documentation/compliance/](Documentation/compliance/) |
| Browse everything | [Documentation/README.md](Documentation/README.md) |

## Contributing

watchpapa.tv is a personal project under an all-rights-reserved licence, so outside contributions are not accepted without prior written permission. If you'd like to help, get in touch through the [contact page](https://watchpapa.tv/contact) first.

## Licence

Copyright © 2026 Krzysztof Durski. All rights reserved. See [LICENCE](LICENCE).

## Acknowledgements

- Movie, TV and people data and images come from [TMDB](https://www.themoviedb.org/). _This product uses the TMDB API but is not endorsed or certified by TMDB._
- Streaming availability ("Where to watch") data is provided by [JustWatch](https://www.justwatch.com/) through TMDB.
- Breached-password checks use the [Have I Been Pwned](https://haveibeenpwned.com/Passwords) range API.
- Built with [Cloudflare Workers and Pages](https://developers.cloudflare.com/), [Supabase](https://supabase.com/), [Hono](https://hono.dev/) and [React](https://react.dev/).

## AI usage

This project was built with AI assistance (Cursor and Claude Code) for brainstorming, implementation, debugging and documentation. The author made the architecture, planning and technical decisions and reviewed and adapted all AI output before it was committed. AI-assisted commits carry a `Co-authored-by` trailer naming the tool.
