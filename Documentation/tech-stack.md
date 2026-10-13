# watchpapa — Tech Stack

> Rewritten 2026-10-13 (the earlier version described the first Express + Sequelize prototype). Authoritative detail: [../CONTEXT.md](../CONTEXT.md).

## Current stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8 (Rolldown), React Router 7, Tailwind CSS 4 (+ `tailwind-merge`), `react-helmet-async`, TipTap (the `/updates` editor), `react-easy-crop`. Hosted on **Cloudflare Pages**, Root directory `Frontend/`. |
| Edge | `Frontend/functions/_middleware.js` — Pages Function: real HTTP 404s, link-preview/JSON-LD injection via `HTMLRewriter` |
| API | **Cloudflare Worker** `watchpapa-api` (`worker/`), Hono 4, plain JavaScript (ESM). Route `api.watchpapa.tv/*`. Cron Trigger every minute drives background CSV imports. |
| Content | **TMDB API v3, read live** by the Worker and edge-cached; nothing stored. "Where to watch" data is JustWatch via TMDB (attribution required). |
| Database | Supabase PostgreSQL (eu-west-1, **Free plan**). Worker access: `postgres.js` over **Cloudflare Hyperdrive** (caching off). Frontend access: `supabase-js` under RLS. |
| Auth | Supabase Auth (email OTP + Google/GitHub). The Worker verifies JWTs locally via JWKS (`jose`, ES256). |
| Email | Supabase Auth SMTP via Resend |
| Storage | Supabase Storage (`avatars` bucket); Cloudflare R2 (encrypted DB backups) |
| Backups | GitHub Actions nightly `pg_dump` → `age` → R2, 30-day retention |
| Breached passwords | Have I Been Pwned range API, called from the browser (`Frontend/src/lib/pwned.js`) |
| Tests | Vitest (Worker); `node --test` for RLS, unit, Playwright e2e, backup pipeline, live smoke; pytest environment check |
| CI/CD | Cloudflare Pages git build + Workers Builds on push to `production`; GitHub Actions for backups and a manual deploy fallback |

## Not used (any more)

Express, Sequelize, Next.js, a DigitalOcean droplet/nginx/pm2, TMDB ingestion scripts, the Streaming Availability (RapidAPI) API, TanStack Query, shadcn/ui, Vercel.

## Environment variables

| Where | Variables |
|---|---|
| Worker (`wrangler.jsonc` vars) | `ALLOWED_ORIGINS`, `SUPABASE_URL`, `BATCH_MAX`, `BATCH_SUBREQ_BUDGET`, `IMPORT_CHUNK_MAX`, `RELEASES_MAX_SHOWS`, `SITEMAP_PAGES`, `RECOMMENDATIONS_MAX_SEEDS`, `RECOMMENDATIONS_PROVIDER_CHECK_MAX`, `SHOW_STATUS_BACKFILL_MAX` |
| Worker (secret) | `TMDB_API_KEY_SECRET` |
| Worker (local dev) | `worker/.dev.vars` + shell var `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` |
| Frontend (Pages / `Frontend/.env`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL` |
| RLS tests (root `.env`) | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY_SECRET` |
| GitHub Actions | `SUPABASE_DB_POOLER_URL`, `AGE_PUBLIC_KEY`, `R2_*` (backup); `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (manual deploy) |
