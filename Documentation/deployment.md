# Deployment — watchpapa.tv

> Rewritten 2026-10-13. The previous version described the DigitalOcean droplet + Express API + nginx + pm2 setup, which was decommissioned in the September 2026 move to a Cloudflare Worker and live TMDB. The old runbook was removed from the repo (it contained the decommissioned server's address); none of it applies any more. There is **no origin server** to SSH into.
>
> Source of truth for architecture and conventions: [../CONTEXT.md](../CONTEXT.md) ("CI/CD & Deployment").

## Infrastructure

| What | Where |
|---|---|
| Frontend | Cloudflare Pages project `watchpapa` — https://watchpapa.tv |
| API | Cloudflare Worker `watchpapa-api` (Hono) — https://api.watchpapa.tv (route `api.watchpapa.tv/*` on the proxied A record) and `watchpapa-api.dursky-k.workers.dev` |
| Database + Auth | Supabase project `slflrvbmlrpwbndzhsjp` (eu-west-1), **Free plan** |
| DB access from the Worker | Cloudflare Hyperdrive binding `HYPERDRIVE` → Supabase session pooler, caching disabled |
| Content | TMDB API v3, read live by the Worker and edge-cached (nothing stored) |
| Background import | Worker Cron Trigger, every minute (`worker/wrangler.jsonc` `triggers.crons`) |
| Backups | GitHub Actions `db-backup.yml` → `age`-encrypted dump → private Cloudflare R2 bucket `watchpapa-db-backups` (30-day lifecycle) |

## How a deploy happens

| Target | Mechanism | Trigger |
|---|---|---|
| Frontend | Cloudflare Pages git build: Root directory `Frontend/`, build `npm run build`, output `dist` | push to `production` |
| Worker | Cloudflare Workers Builds: root `worker/`, `npx wrangler deploy` | push to `production` |
| Worker (fallback) | `.github/workflows/deploy-worker.yml` (`npm ci && npm test && wrangler deploy`) | manual `workflow_dispatch` only |
| Database schema | Apply the next-numbered file from `Backend/src/db/migrations/` with the Supabase MCP `apply_migration` (or the SQL editor). Migrations are one-way — never edit an applied file | manual |

Do **not** add a `wrangler.toml` to `Frontend/`. With `pages_build_output_dir` set, Pages treats it as the authoritative project config and stops injecting the dashboard's Production environment variables into the build (this broke production on 2026-10-13). `Frontend/functions/_middleware.js` is picked up automatically without one.

## Configuration

**Pages → Settings → Environment variables (Production):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL=https://api.watchpapa.tv`. The frontend calls the Worker cross-origin; it must be set.

**Worker:** non-secret `vars` live in `worker/wrangler.jsonc` (`ALLOWED_ORIGINS`, `SUPABASE_URL`, the `BATCH_*` / `IMPORT_*` / `RECOMMENDATIONS_*` / `SHOW_STATUS_BACKFILL_MAX` caps, `RELEASES_MAX_SHOWS`, `SITEMAP_PAGES`). Secret: `TMDB_API_KEY_SECRET` (`cd worker && npx wrangler secret put TMDB_API_KEY_SECRET`). Rate limits are the `RL_GLOBAL` (240/min) and `RL_MUTATION` (30/min) bindings in the same file.

**GitHub Actions secrets**
- `deploy-worker.yml`: `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit + Account Hyperdrive:Read + Zone Workers Routes:Edit), `CLOUDFLARE_ACCOUNT_ID`.
- `db-backup.yml`: `SUPABASE_DB_POOLER_URL` (session pooler string — the direct host is IPv6-only and GitHub runners have no IPv6), `AGE_PUBLIC_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. The matching **age private key is kept offline**; without it backups cannot be read.

## Everyday commands

```bash
# Worker: run locally (needs worker/.dev.vars and the Hyperdrive env var below)
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://…pooler…?sslmode=require"
cd worker && npm run dev            # http://localhost:8787, check /health
cd worker && npm test               # vitest

# Worker: deploy by hand / live logs
cd worker && npx wrangler deploy
cd worker && npx wrangler tail

# Frontend
cd Frontend && npm run dev          # http://localhost:5173, proxies /api -> :8787
cd Frontend && npm run build && npm run lint

# Regenerate the OG image + favicons (manual; outputs are committed)
cd Frontend && npm run gen:assets

# Root test suites
npm run test:rls     # live DB, rolled-back transactions (needs root .env)
npm run test:unit
npm run test:e2e     # Playwright, network mocked; first: cd Frontend && npx playwright install chromium
npm run test:backup  # needs Docker + age
npm run test:smoke   # live Supabase + Worker, creates and deletes one throwaway user
```

## Backups and restore

Nightly at 03:17 UTC (`db-backup.yml`, also runnable via `workflow_dispatch`). A failed run emails the repo owner — that is the alert. Contents: the full `public` schema (DDL, data, RLS, functions, triggers, grants), data-only `auth.users` / `auth.identities` / `auth.audit_log_entries` / `storage.buckets` / `storage.objects`, and `CREATE EXTENSION` for extensions installed in `public`. **Not** included: sessions/refresh tokens, avatar files (only their metadata), the trigger on `auth.users` (re-apply `026_handle_new_user_trigger.sql`).

Restore into a fresh Supabase project, using a `psql` at least as new as the dump's `pg_dump` (17):

```bash
age -d -i key.txt watchpapa-YYYY-MM-DD.sql.gz.age | gunzip | psql "<url>" -v ON_ERROR_STOP=1
```

`permission denied to change default privileges` errors for `supabase_admin` are expected on a fresh project (re-run with `ON_ERROR_STOP=0`). A real-project restore drill (2026-10-12) gave identical row counts for all 40 tables. The extension-inclusive backup (fix `6da6772`) has not yet been verified against real infrastructure: run the workflow once and confirm the R2 object exists and is slightly larger than the previous night's.

## Troubleshooting

| Symptom | Check |
|---|---|
| Site loads but every API call fails / CORS error | Pages env var `VITE_API_BASE_URL` set to `https://api.watchpapa.tv`? Origin listed in `ALLOWED_ORIGINS`? |
| Supabase client errors in the browser (auth or queries fail) | `VITE_SUPABASE_*` missing from the Pages Production env — and check there is no `Frontend/wrangler.toml` |
| Worker 500s on user-data routes | `npx wrangler tail`; Hyperdrive binding id in `wrangler.jsonc`; remember `fetch_types:false` breaks array bind params (see CONTEXT.md) |
| Background import stuck | Cron Trigger running? (`wrangler tail` shows `[IMPORT]` lines each minute); a step that throws is retried on the next tick |
| Unknown URLs return 200 instead of 404 | `Frontend/functions/_middleware.js` not deployed — Pages Root directory must be `Frontend/` |
| Supabase project paused | Free plan auto-pauses after inactivity; the Worker's 1/min cron query normally prevents it |
