# CONTEXT.md — watchpapa.tv Codebase Reference

Monorepo for watchpapa.tv — a web app for tracking movie/TV show releases. Co-located Express backend (root) and Vite React frontend (`Frontend/`). For product narrative, setup, and ER diagram see `README.md`; for architecture deep-dives see `docs/`; for recent releases see `releases.md`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 5, React Router 7, Tailwind CSS 4 |
| Backend | Node.js ESM, Express 4, Helmet, express-rate-limit |
| ORM / DB access | Sequelize 6 driver-mode only — `sequelize.query()` with named `replacements:`. Never model CRUD. |
| Database | Supabase PostgreSQL (managed). SSL required. |
| Auth | Supabase Auth — JWT bearer tokens. Backend uses service-role key to verify. |
| Image CDN | TMDB CDN direct: `https://image.tmdb.org/t/p/{size}{path}`. DB stores path only. |
| Deployment | DigitalOcean Droplet, Ubuntu 24.04, systemd (`watchpapa` service), Nginx reverse proxy |
| Frontend host | Cloudflare Pages (`watchpapa.tv`). API at `api.watchpapa.tv` (Cloudflare proxy → Droplet, SSL Flexible). |
| CI/CD | GitHub Actions — 5 workflows, self-hosted runner |
| Email | Supabase Auth SMTP via Resend |
| Testing | Node built-in test runner (injection tests), pytest (RLS tests) |

---

## Repository Layout

```
watchpapa/
├── index.js                          # HTTP server entry — connects DB, calls app.listen()
├── app.js                            # Express app factory — all routes/middleware mounted here
├── package.json                      # npm scripts: start, dev, seed:tmdb:*, test:*
├── Backend/src/
│   ├── db/
│   │   ├── database.js               # Sequelize instance (DATABASE_URL + SSL)
│   │   └── migrations/               # 001–015 SQL migration files — apply via Supabase MCP
│   ├── routes/
│   │   ├── search.js                 # GET /api/search — local + TMDB fallback
│   │   ├── posters.js                # GET /api/posters — random poster paths for auth BG
│   │   ├── inject.js                 # POST /api/inject — background TMDB ingest
│   │   ├── resolve.js                # POST /api/resolve — stub upsert + background ingest
│   │   ├── referral.js               # POST /api/referral/use/:code
│   │   ├── rewards.js                # POST /api/rewards/claim
│   │   ├── announcements.js          # GET (public) + POST/PATCH (requireEditor inside)
│   │   └── sitemap.js                # /sitemap*.xml handlers (5 sitemaps)
│   │   └── admin/                    # All require adminLimiter + requireAuth + requireAdmin
│   │       ├── rewardCodes.js        # /api/admin/reward-codes CRUD
│   │       ├── stats.js              # /api/admin/stats
│   │       ├── users.js              # /api/admin/users
│   │       ├── referrals.js          # /api/admin/referrals
│   │       ├── auditLog.js           # /api/admin/audit-log
│   │       ├── scriptLogs.js         # /api/admin/script-logs
│   │       ├── announcements.js      # /api/admin/announcements
│   │       └── resync.js             # /api/admin/resync
│   ├── middleware/
│   │   ├── requireAuth.js            # Validates Bearer JWT via Supabase service-role client
│   │   ├── requireAdmin.js           # Requires profile.role = 4
│   │   ├── requireEditor.js          # Requires profile.role >= 3
│   │   └── auditLog.js               # Writes selected request fields to audit_events
│   ├── services/
│   │   └── searchService.js          # Local DB search + TMDB fallback + fast-upsert helpers
│   ├── lib/
│   │   ├── ingestionQueue.js         # dedupIngest(key, fn) — deduplicates concurrent ingest jobs
│   │   ├── logScriptRun.js           # Writes outcome rows to script_logs
│   │   ├── sanitizeTmdb.js           # Normalises TMDB API payloads before DB writes
│   │   ├── tmdb_rate_limited_fetch.js # fetch() wrapper, ~40 req/s rate limit
│   │   └── tmdb_changes_fetch.js     # Fetches entity change lists from TMDB
│   └── scripts/                      # ~44 TMDB ingestion scripts (npm run seed:tmdb:*)
│       ├── inject_{movie,tv_show,person,genres,jobs_and_departments}.js
│       ├── inject_popular_{movies,shows,people}_today.js
│       ├── inject_top_rated_{movies,shows}.js
│       ├── inject_changed_{all,movies,shows,people}_24h.js
│       └── update_tmdb_popularity_{movies,shows,people}.js
├── Frontend/src/
│   ├── main.jsx                      # Vite entry — mounts <App /> inside <BrowserRouter>
│   ├── App.jsx                       # Full route tree + auth/session bootstrap
│   ├── layouts/
│   │   ├── AppLayout.jsx             # Main shell with Navbar + Footer
│   │   └── AuthLayout.jsx            # Minimal shell for auth pages
│   ├── pages/
│   │   ├── app/                      # Public + protected app pages (see route map below)
│   │   ├── auth/                     # Auth flow pages (see route map below)
│   │   └── admin/                    # Admin dashboard pages (AdminRoute guard)
│   ├── features/                     # Per-domain hooks — one hooks/ subfolder per domain
│   │   └── admin/
│   │       ├── adminFetch.js         # Fetch helper that auto-attaches session Bearer token
│   │       └── hooks/                # useAdminAnnouncements, useScriptLogs, useIsAdmin (role check for non-admin pages), …
│   ├── features/watchlist/hooks/     # useWatchlists, useWatchlistItems(watchlistId, session, refreshKey), useItemWatchlistStatus
│   ├── features/rating/hooks/        # useRating(mediaType, entityId, session), useCommunityRatings(mediaType, entityId)
│   ├── features/profile/hooks/       # useProfileData(username, session), useProfileRatings(profileId), useProfileStats(profileId, ownerTier), useEditProfile(session), useProfileRecapStats(profileId, tier) — fetches last 30 days of user_rating and aggregates into weekly/monthly windows client-side
│   ├── features/follows/hooks/       # useFollows(session), useOverageStatus(session, refreshKey) — NOTE: ReleasesCalendarPage and FollowsPage derive overage live from reactive arrays instead of calling this hook
│   ├── components/
│   │   ├── watchlist/                # AddToWatchlistButton — auto-adds to first list, toast + checklist picker (multi-list); compact prop for WatchlistsPage
│   │   ├── rating/                   # HeartDisplay, RatingInput, RatingButton, RatingSidebar (always-visible sidebar widget), RatingHistogram (bar tooltips on hover)
│   │   ├── profile/
│   │   │   ├── generateShareCard.js  # Canvas 2D renderer for 4K share cards (story 9:16, square 1:1, wide 16:9); tier-gated layouts + personality emoji; scale param for preview (1x) vs download (3x). Exports generateRecapShareCard(format, recapData, profileData, scale) for weekly/monthly recap cards
│   │   │   └── ProfileShareModal.jsx # Format picker (3 pills), cardType selector (Profile/Weekly/Monthly), WYSIWYG preview (canvas at 1x scale), Download PNG + Share (Web Share API mobile, fallback download on desktop). Recap tabs only show if recapStats has data
│   │   │   # Also: ProfileFavourites, FavouritesEditor, ProfileStats (tier-gated blur), ProfileRatingCard
│   │   ├── detail/
│   │   │   ├── generateMediaShareCard.js # Canvas generator for movie/show share cards (3 formats: story 9:16, square 1:1, wide 16:9; 3 detail levels: minimal/standard/rich). Loads poster via TMDB + logo, renders hearts if user rated
│   │   │   └── MediaShareModal.jsx # Format + detail level selectors (pill buttons), live preview, Download (4K) + Share buttons. Internally calls useRating to fetch user's rating for the media
│   │   ├── layout/                   # Navbar, Footer, Breadcrumbs, ProfileMenu (hover→dropdown desktop / click→profile; click→dropdown mobile), PosterBackground
│   │   ├── ui/                       # Button, Input, Toggle, OtpInput, PageHead, RichTextEditor, OverLimitBanner, …
│   │   ├── detail/                   # DetailPageLayout, PosterCard, CastGrid, FollowButton, AdminResyncButton (admin-only, role 4; shown on Movie/Show/Person pages), …
│   │   ├── home/                     # MediaCard, MediaGrid, MediaRow, SearchBar
│   │   ├── auth/                     # AdminRoute (route guard)
│   │   ├── subscription/             # EarlyAdopterBanner, UpgradePromptToast
│   │   └── static/                   # InfoPageShell
│   └── lib/
│       ├── supabase.js               # Supabase JS client (anon key, consent-aware storage)
│       ├── cookieConsent.js          # Cookie consent state helpers
│       ├── constants.js              # App-wide constants
│       ├── cn.js                     # Tailwind class merger
│       └── validate.js               # Form validation utilities
├── tests/
│   ├── injections_tests/             # Node test runner — ingestion pipeline tests
│   └── rls_tests/                    # RLS policy enforcement tests
├── .github/workflows/                # deploy, daily-sync, weekly-sync, full-sync, seed-one-off
├── scripts/                          # Nginx config, systemd service, droplet setup, seed-manual.sh
└── docs/                             # Architecture/security/DB deep-dive markdown files
```

---

## Environment Variables

**Backend (root `.env`):**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase session pooler PostgreSQL URL (IPv4, port 5432) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — used by backend auth middleware and admin DB access |
| `TMDB_API_KEY_SECRET` | TMDB v3 API key for all ingestion and resolve calls |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins; defaults to `localhost:5173,4173` |
| `PORT` | HTTP port; defaults to `3000` |
| `NODE_ENV` | Set to `production` on server |

**Frontend (`Frontend/.env`):**

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Passed to Supabase JS client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key (also accepted as `VITE_SUPABASE_ANON_KEY`) |
| `VITE_API_BASE_URL` | Backend origin; empty string in production (Cloudflare routes) |

---

## API Route Map

**Public / user routes** (all under global rate limit 120 req/min):

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/search` | None | `?q=&limit=&localPerType=&includeAdult=` — local catalog + TMDB |
| `GET` | `/api/image-proxy` | None | `?path=&size=` — CORS-compliant TMDB poster proxy for canvas rendering; used by profile share card generator |
| `GET` | `/api/posters` | None | Random poster paths for auth page background |
| `POST` | `/api/inject` | JWT + perUser rateLimit + auditLog | Background-ingest TMDB entity `{type, tmdbId}` |
| `POST` | `/api/resolve` | JWT + perUser rateLimit + auditLog | Stub upsert + background ingest; returns local `id` |
| `POST` | `/api/referral/use/:code` | JWT + perUser rateLimit + auditLog | Apply referral code |
| `POST` | `/api/rewards/claim` | JWT + perUser rateLimit + auditLog | Claim reward code, apply tier upgrade |
| `POST` | `/api/import/resolve` | JWT + perUser rateLimit | Resolve `[{name, year}]` to local movie IDs; TMDB fallback + fast-upsert for unmatched |
| `POST` | `/api/import/commit` | JWT + perUser rateLimit | Batch-insert `user_rating` + `watchlist_item`; ON CONFLICT skip or overwrite per `conflictMode` |
| `POST` | `/api/import/run` | JWT + perUser rateLimit | Fire-and-forget import: validates + creates watchlist synchronously, returns 202, then processes each unique film in the background — stub-upsert → commit user data immediately → fire full ingest. Resilient to mid-run crashes; 5 MB body limit. |
| `GET` | `/api/import/export` | JWT + perUser rateLimit | Stream watchpapa CSV (ratings + watchlist) as `watchpapa-export-YYYY-MM-DD.csv` |
| `GET` | `/api/announcements` | None | Active (non-archived) announcements |
| `POST` | `/api/announcements` | JWT + requireEditor (inside router) | Create announcement |
| `PATCH` | `/api/announcements/:id` | JWT + requireEditor | Edit announcement |
| `PATCH` | `/api/announcements/:id/archive` | JWT + requireEditor | Archive announcement |
| `GET` | `/sitemap.xml` | None | Sitemap index |
| `GET` | `/sitemap-{static,movies,shows,people}.xml` | None | Per-entity sitemaps |
| `GET` | `/health` | None | `{ status: "ok" }` |

**Admin routes** (all: adminLimiter + requireAuth + requireAdmin, role = 4):

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/users/search?email=` | Search users |
| `GET` | `/api/admin/users/staff` | Role 3 + 4 accounts |
| `PATCH` | `/api/admin/users/:id/role` | Set user role (0, 3, or 4) |
| `POST` | `/api/admin/users/:id/grant-tier` | Upgrade tier via `apply_tier_upgrade` (upgrade-only, no downgrade) |
| `PATCH` | `/api/admin/users/:id/tier` | Direct tier set — any tier incl. `free` and `god`; bypasses rank guards; `free` deletes the subscription row |
| `*` | `/api/admin/reward-codes` | Reward code CRUD |
| `GET` | `/api/admin/stats` | Platform statistics |
| `GET` | `/api/admin/referrals` | Referral leaderboard |
| `GET` | `/api/admin/audit-log` | Audit event log |
| `GET` | `/api/admin/script-logs` | Ingestion script run logs |
| `GET` | `/api/admin/stats/catalog` | Row counts for all content + activity tables (movies, shows, seasons, episodes, people, credits, ratings, follows, watchlists, favourites) |
| `*` | `/api/admin/announcements` | Announcement management (includes restore) |
| `GET` | `/api/admin/resync/search` | Search local catalog for resync |
| `POST` | `/api/admin/resync` | Trigger scoped re-ingest for a single item |
| `POST` | `/api/admin/resync/bulk` | Bulk re-ingest up to 1,000 items of a type; optional `since` ISO timestamp to filter by `updated_at` |

---

## Frontend Route Map

| Path | Guard | Component | Notes |
|---|---|---|---|
| `/login` | PublicOnly | `LoginPage` | Redirect signed-in users → `/` |
| `/register` | PublicOnly | `RegisterPage` | |
| `/verify-email` | PublicOnly | `VerifyEmailPage` | |
| `/forgot-password` | PublicOnly | `ForgotPasswordPage` | |
| `/reset-password` | None | `ResetPasswordPage` | |
| `/complete-username` | Protected (setup) | `CompleteUsernamePage` | Required gate after first signup; redirects away if username exists |
| `/` | Public | `AppHomePage` | |
| `/search` | Public | `SearchPage` | |
| `/movies` | Public | `MoviesPage` | |
| `/movies/:id` | Public | `MoviePage` | Local DB `id` |
| `/movies/tmdb/:tmdbId` | Public | `TmdbResolvePage` | Resolves TMDB id → redirect to `/movies/:id` |
| `/shows` | Public | `ShowsPage` | |
| `/shows/:id` | Public | `ShowPage` | |
| `/shows/:id/seasons/:seasonId` | Public | `SeasonPage` | |
| `/shows/:id/seasons/:seasonId/episodes/:episodeId` | Public | `EpisodePage` | |
| `/shows/tmdb/:tmdbId` | Public | `TmdbResolvePage` | |
| `/people` | Public | `PeoplePage` | |
| `/people/:id` | Public | `PersonPage` | |
| `/people/tmdb/:tmdbId` | Public | `TmdbResolvePage` | |
| `/calendar` | Public | `ReleasesCalendarPage` | Today's releases highlighted amber; multiple episodes from same season collapse to "Season X"; hovered day scales 6% with purple border; calendar blocked (overage gate) when follow count exceeds tier limit — computed live from reactive arrays |
| `/updates` | Public | `UpdatesPage` | Announcements feed |
| `/subscription` | Public | `SubscriptionPage` | |
| `/about`, `/help`, `/terms`, `/contact`, `/privacy` | Public | `StaticInfoPages` | |
| `/settings` | Protected | `SettingsPage` | Requires session |
| `/watchlists` | Protected | `WatchlistsPage` | Tabbed page: all lists as tabs, items + All/Watched/Unwatched filter shown inline |
| `/follows` | Protected | `FollowsPage` | All followed shows + movies with unfollow buttons; tabs Shows/Movies; overage banner |
| `/u/:username` | Protected | `ProfilePage` | Public profile: bio, tier badge, 5 favourites, stats (owner-tier-gated), ratings grid |
| `/profile/edit` | Protected | `EditProfilePage` | Edit bio (200 chars) + 5 favourites (search picker) |
| `/import` | Protected | `ImportPage` | Import from Letterboxd CSV or watchpapa CSV; step-by-step UI with resolve + commit flow |
| `/admin` | AdminRoute (role=4) | `AdminPage` (nested) | |
| `/admin` (index) | Admin | `StatsPage` | |
| `/admin/reward-codes` | Admin | `RewardCodesPage` | |
| `/admin/early-adopters` | Admin | `EarlyAdoptersPage` | |
| `/admin/users` | Admin | `UserLookupPage` | |
| `/admin/referrals` | Admin | `ReferralLeaderboardPage` | |
| `/admin/audit-log` | Admin | `AuditLogPage` | |
| `/admin/script-logs` | Admin | `ScriptLogsPage` | |
| `/admin/announcements` | Admin | `AnnouncementsPage` | |
| `/admin/staff` | Admin | `StaffPage` | |
| `/admin/catalog-stats` | Admin | `CatalogStatsPage` | Row counts for movies, shows, seasons, episodes, people, credits, ratings, follows, watchlists, favourites |
| `/admin/resync` | Admin | `ContentResyncPage` | Bulk resync section (type + time window, capped 1,000) + per-item search resync |
| `*` | — | `<Navigate to="/" />` | Catch-all |

Route guards defined in `App.jsx`: `PublicOnlyRoute`, `ProtectedRoute`, `PublicRoute`, `AdminRoute` (in `components/auth/AdminRoute.jsx`).

---

## Database Schema Summary

**Content tables (public schema):**

| Table | PK | Key columns | Notes |
|---|---|---|---|
| `movie` | `bigint` identity | `tmdb_id` (unique), `title`, `adult`, `tmdb_popularity`, `poster_path`, `deleted_at` | Soft-delete: filter `deleted_at IS NULL` |
| `show` | `bigint` identity | `tmdb_id` (unique), `name`, `adult`, `in_production`, `tmdb_popularity`, `poster_path` | |
| `season` | `bigint` identity | `tmdb_id` (unique), `show_id` FK, `season_number` | |
| `episode` | `bigint` identity | `tmdb_id` (unique), `season_id` FK, `episode_number`, `air_date` | |
| `person` | `bigint` identity | `tmdb_id` (unique), `name`, `adult`, `profile_path`, `deleted_at` | Soft-delete |
| `person_aka` | `bigint` identity | `person_id` FK, `nickname`, `deleted_at` | Soft-delete for delta sync |
| `genres` | `bigint` identity | `tmdb_id` (unique), `name` | |
| `department` | `bigint` identity | `name` | TMDB department |
| `job` | `bigint` identity | `department_id` FK, `name` | |
| `movie_credits` | `bigint` identity | `movie_id`, `person_id`, `job_id` FKs, `character_name` | Full-replace per movie on ingest |
| `show_credits` | `bigint` identity | `show_id`, `person_id`, `job_id` FKs | Full-replace per show |
| `episode_credits` | `bigint` identity | `episode_id`, `person_id`, `job_id` FKs | Full-replace per episode |
| `movie_genre` | `bigint` identity | `movie_id`, `genres_id` | |
| `show_genre` | `bigint` identity | `show_id`, `genres_id` | |
| `script_logs` | `uuid` | `script_name`, `status`, `batch_size`, `started_at`, `finished_at` | Ingestion run audit |

**User / auth tables:**

| Table | PK | Key columns | Notes |
|---|---|---|---|
| `profile` | `uuid` (= `auth.users.id`) | `username` (unique), `role`, `bio`, `is_adult`, `date_of_birth`, `setting_display_adult_content`, `referral_code` | role: 0=user, 3=editor, 4=admin; bio≤200 chars |
| `user_rating` | `bigint` identity | `profile_id`, `movie_id`/`show_id`/`season_id`/`episode_id` FK (exactly one), `value` (1–10), `created_at` | All ratings public (anon readable). Partial unique indexes per content type. |
| `profile_favourite` | `bigint` identity | `profile_id`, `position` (1–5), `movie_id`/`show_id` FK (exactly one) | Up to 5 pinned items per user. Unique on (profile_id, position). |
| `user_followed_movies` | `bigint` identity | `profile_id`, `movie_id` (unique pair) | |
| `user_followed_shows` | `bigint` identity | `profile_id`, `show_id` (unique pair) | |
| `user_subscriptions` | `uuid` | `profile_id`, `tier`, `is_early_adopter`, `expires_at`, `ea_banner_dismissed` | Use `get_effective_tier()` RPC — never raw `tier` |
| `reward_codes` | `uuid` | `code`, `tier`, `duration_days`, `max_uses`, `is_active` | |
| `reward_code_claims` | `uuid` | `code_id`, `profile_id` | Prevents duplicate claims |
| `referrals` | `uuid` | `referrer_id`, `referred_id` (unique) | |
| `audit_events` | `uuid` | `action`, `user_id`, `ip`, `method`, `path`, `body`, `created_at` | Written by `auditLog` middleware |
| `announcements` | `uuid` | `title`, `body`, `archived`, `author_id`, `archived_by`, `archived_at` | |
| `watchlist` | `bigint` identity | `profile_id`, `name`, `created_at`, `updated_at` | Per-tier limit enforced by `enforce_watchlist_limit` trigger |
| `watchlist_item` | `bigint` identity | `watchlist_id` FK, `media_type` ('movie'|'show'), `movie_id`/`show_id` FK, `watched`, `added_at` | Partial unique indexes prevent duplicate items per list |

---

## watchpapa CSV format

Used for both export (from Settings) and import (on `/import` page). Round-trips cleanly.

```
Date,Name,Year,MediaType,WatchlistName,Rating,Watched
2026-01-15,Oppenheimer,2023,movie,,10,
2026-01-20,Interstellar,2014,movie,My List,9,true
```

| Column | Type | Notes |
|---|---|---|
| `Date` | `YYYY-MM-DD` | Date added/rated |
| `Name` | string | Film title |
| `Year` | 4-digit string | Release year |
| `MediaType` | `movie` | Only movies currently (Letterboxd is movies-only) |
| `WatchlistName` | string | Watchlist name, empty if rating-only row |
| `Rating` | integer 1–10 | watchpapa scale; empty if not rated |
| `Watched` | `true`/`false` | Watchlist watched status; empty if not in a watchlist |

The `/api/import/resolve` endpoint also accepts Letterboxd CSV format (auto-detected by headers: `Letterboxd URI` column). Letterboxd ratings (0.5–5) are multiplied by 2 to convert to the 1–10 scale.

---

## Migration History

| # | File | What it adds |
|---|---|---|
| 001 | `audit_events` | Creates `audit_events` table |
| 002 | `audit_user_follow_triggers` | DB triggers: write audit rows on follow/unfollow |
| 003 | `profile_referral_columns` | Adds `referral_code` and referral columns to `profile` |
| 004 | `subscription_tables` | Creates `user_subscriptions`, `reward_codes`, `reward_code_claims`, `referrals` |
| 005 | `subscription_functions` | DB functions: `apply_tier_upgrade`, `check_and_complete_referral`, `get_effective_tier` |
| 006 | `profile_insert_trigger` | Auto-assigns early-adopter Premium to first 5,000 users on `profile` insert |
| 007 | `follow_limit_trigger` | Enforces per-tier follow count limits at DB level |
| 008 | `referral_rewards` | Adds referral reward distribution logic |
| 009 | `subscription_rls` | RLS policies for subscription tables |
| 010 | `protect_sensitive_columns` | REVOKE + BEFORE UPDATE trigger: blocks user self-modification of `role`/`referral_code` |
| 011 | `username_change_limit` | Rate-limits username changes |
| 012 | `ea_banner_dismissed` | Adds `ea_banner_dismissed` column to `user_subscriptions` |
| 013 | `analytics` | Creates analytics tables + `track_presence`, `track_page_view`, `track_content_click` RPCs |
| 013b | `analytics_rollback` | Rollback for migration 013: drops analytics tables and RPC functions |
| 014 | `announcements` | Creates `announcements` table |
| 015 | `announcements_archive_tracking` | Adds `archived_by`, `archived_at` columns for archive audit trail |
| 016 | `watchlists` | Creates `watchlist` and `watchlist_item` tables with RLS and `enforce_watchlist_limit` trigger |
| 017 | `ratings_and_profiles` | Creates `user_rating`, `profile_favourite`; adds `profile.bio`; RLS; `get_profile_genre_stats(UUID)` and `get_limit_status(UUID)` functions |
| 018 | `security_hardening` | `SET search_path` on tier/watchlist functions; REVOKE analytics RPCs from anon/authenticated |
| 019 | `drop_analytics` | Drops analytics tables and `track_*` RPCs (product analytics removed from app) |
| 020 | `social_observe` | Social features: user "observe" (follow) with public/private accounts, blocking, notifications; adds RLS tables and SECURITY DEFINER RPCs for visibility gating |
| 021 | `profile_share_setting` | Adds `setting_allow_profile_share` boolean column to `profile` table |
| 023 | `audit_log_retention` | Enables `pg_cron` extension; schedules daily cleanup of `audit_events` rows older than 90 days (GDPR compliance) |
| 024 | `account_deletion_hardening` | Adds `ON DELETE CASCADE` to `user_followed_movies` and `user_followed_shows` FKs; adds trigger to delete audit_events on profile deletion |
| 025 | `marketing_email_opt_in` | Adds `email_marketing_opt_in` boolean column to `profile` table for GDPR-compliant product announcement opt-in |
| 026 | `handle_new_user_trigger` | Updates `handle_new_user()` function to copy `email_marketing_opt_in` from auth metadata to profile (persists registration opt-in checkbox value) |
| 027 | `username_nullable` | Drops NOT NULL on `profile.username` so OAuth signups succeed. Google/GitHub metadata has no `username` key, so the trigger was inserting NULL into a NOT NULL column → "Database error saving new user". NULL username is detected by the frontend as `needsUsernameSetup = true` and gates the user to `/complete-username`. Also nullifies the one stuck user who had `username = ''`. |
| 028 | `date_of_birth_nullable` | Drops NOT NULL on `profile.date_of_birth`. Same root cause as 027 — OAuth metadata has no `date_of_birth`, so the trigger still failed after 027. OAuth users provide their DOB on the `/complete-username` page. |

To add the next migration: create `Backend/src/db/migrations/029_<name>.sql`, apply via Supabase migration workflow.

---

## Subscription & Role Reference

**Subscription tiers** (enforced by `get_effective_tier(profile_id)` RPC — never trust raw `tier` column alone):

| Tier | Show follows | Movie follows | Notes |
|---|---|---|---|
| `free` | 3 | 1 | Default when no `user_subscriptions` row |
| `premium` | 10 combined | 10 combined | Early adopters (first 5,000) get this for life via migration 006 trigger |
| `pro` | 100 | 100 | |
| `pro_plus` | 100 | 100 | Same as pro; placeholder for no-ads |
| `god` | unlimited | unlimited | Admin-only grant, never expires |

**Profile stats visibility** (based on profile *owner's* tier — viewer's tier does not matter):

| Stat | Free | Premium | Pro / Pro+ |
|---|:---:|:---:|:---:|
| Total ratings, avg, own distribution histogram | ✓ | ✓ | ✓ |
| Genre breakdown | locked | ✓ | ✓ |
| Decade breakdown | locked | locked | ✓ |
| Monthly activity heatmap | locked | locked | ✓ |

Locked widgets show **fake seeded data** under a blur overlay + upgrade CTA (not a spinner, not blank — real data never fetched).

**Watchlist limits per tier** (enforced by `enforce_watchlist_limit` DB trigger):

| Tier | Max watchlists |
|---|---|
| `free` | 1 |
| `premium` | 3 |
| `pro` / `pro_plus` | 10 |
| `god` | unlimited |

**Profile roles:**

| Value | Label | Access |
|---|---|---|
| `0` | User | Standard authenticated access |
| `3` | Editor | Can create/edit/archive announcements (`requireEditor` passes 3 or 4) |
| `4` | Admin | Full admin panel + all `/api/admin/*` routes (`requireAdmin` requires exactly 4) |

---

## Auth Flow

**Frontend (`App.jsx`):**
- Boot: `supabase.auth.getSession()` → `supabase.auth.getUser()` (validates token); then `onAuthStateChange` keeps state live.
- New users with no `profile.username` are gated to `/complete-username` before any other protected route.
- `showAdult` is read from `profile.setting_display_adult_content` and passed as a prop through the route tree.
- Storage is consent-aware: `localStorage` if cookie consent accepted, `sessionStorage` otherwise.

**Backend (per-request):**
- `requireAuth`: validates `Authorization: Bearer <token>` via `supabase.auth.getUser(token)` with service-role client; attaches `req.user`.
- `requireAdmin`: queries `profile.role` from DB; requires `role = 4`.
- `requireEditor`: queries `profile.role`; requires `role = 3 or 4`.

---

## TMDB Ingestion Architecture

**Three ingest paths:**
1. **Scheduled batch** — GitHub Actions cron workflows run popular/top-rated/changed scripts nightly or weekly.
2. **On-demand `/api/resolve`** — upserts a stub row immediately (returns local `id`), then fires full ingest in background via `dedupIngest`.
3. **On-demand `/api/inject`** — fires full background ingest without the stub-first step; used when the frontend navigates to a TMDB-keyed URL.

**Key library files:**
- `Backend/src/lib/ingestionQueue.js` — `dedupIngest(key, fn)`: prevents concurrent duplicate ingestion of the same entity. Always use when triggering background ingest from an API route.
- `Backend/src/lib/tmdb_rate_limited_fetch.js` — wraps `fetch` at ~40 req/s.
- `Backend/src/lib/logScriptRun.js` — writes outcome to `script_logs` after each run.
- `Backend/src/lib/sanitizeTmdb.js` — normalises TMDB API payloads before DB writes.

**Ingest pattern (all entity types):**
1. Upsert top-level row by `tmdb_id` using `ON CONFLICT (tmdb_id) DO UPDATE`.
2. Replace related rows (credits, genres, aliases) via delete-then-bulk-insert in a transaction.
3. Log run outcome to `script_logs` via `logScriptRun`.

---

## CI/CD & Deployment

| Workflow | Trigger | What it does |
|---|---|---|
| `deploy.yml` | Push to `production` branch | SSH → Droplet, `git reset --hard`, `npm install --omit=dev`, restart systemd |
| `daily-sync.yml` | Cron `0 0 * * *` (midnight UTC) | Popular + top-rated ingest (100 each), update popularity scores |
| `weekly-sync.yml` | Cron `0 0 * * 1` (Monday midnight) | Refresh all changed entities (7-day window) |
| `full-sync.yml` | `workflow_dispatch` | Changed + popular + top-rated + popularity update |
| `seed-one-off.yml` | `workflow_dispatch` | Run any single seed script with configurable args (`--id`, `--limit`, `--force`) |

All sync workflows run on `self-hosted` runner. Deploy runs on `ubuntu-latest`.

**Required GitHub Secrets:** `DATABASE_URL`, `TMDB_API_KEY_SECRET`, `DROPLET_HOST`, `DROPLET_SSH_KEY`, `SMTP_SERVER`, `SMTP_USERNAME`, `SMTP_PASSWORD`

**Production:** Frontend `https://watchpapa.tv` (Cloudflare Pages). API `https://api.watchpapa.tv` (Cloudflare proxy → DigitalOcean, SSL Flexible).

---

## Common Workflow Patterns

**New app feature page:**
1. Page component → `Frontend/src/pages/app/`
2. Domain hook → `Frontend/src/features/<domain>/hooks/use<Name>.js`
3. Register route in `App.jsx` under `PublicRoute` or `ProtectedRoute`
4. Supabase data: query via `supabase` client in the hook
5. Express API data: `fetch(\`${import.meta.env.VITE_API_BASE_URL}/api/...\`, { headers: { Authorization: \`Bearer ${session.access_token}\` } })`

**New API endpoint:**
1. Route file → `Backend/src/routes/` (or `routes/admin/`)
2. Mount in `app.js` with the appropriate middleware chain
3. All DB queries: `sequelize.query(sql, { replacements: {...}, type: QueryTypes.SELECT })`

**New admin feature:**
1. Backend route → `Backend/src/routes/admin/`
2. Mount in `app.js` with `adminLimiter, requireAuth, requireAdmin`
3. Frontend hook → `Frontend/src/features/admin/hooks/` using `adminFetch(path, options)` helper
4. Page → `Frontend/src/pages/admin/`
5. Register as nested child of `/admin` in `App.jsx`

**Schema change (new migration):**
1. Create `Backend/src/db/migrations/016_<name>.sql`
2. Apply via `mcp__claude_ai_Supabase__apply_migration`
3. Update the Migration History table in this file

**New TMDB ingestion script:**
1. Script → `Backend/src/scripts/`
2. Add npm script to `package.json` (`"seed:tmdb:<name>": "node Backend/src/scripts/<name>.js"`)
3. Wire into the appropriate GitHub Actions workflow if recurring

---

## External Integrations

| Service | Role | Config |
|---|---|---|
| TMDB API v3 | Content metadata source | `TMDB_API_KEY_SECRET`; all calls via `tmdb_rate_limited_fetch.js` |
| Supabase Auth | Email/OTP auth, JWT issuance | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (backend); `VITE_SUPABASE_*` (frontend) |
| Supabase PostgreSQL | Primary database | `DATABASE_URL` (session pooler, SSL) |
| Cloudflare Pages | Frontend hosting | Build: `cd Frontend && npm run build`; publish dir: `Frontend/dist` |
| Cloudflare Proxy | SSL termination for API | `api.watchpapa.tv` A record, SSL mode: Flexible |
| DigitalOcean Droplet | Backend hosting | Ubuntu 24.04, Amsterdam (ams3); app runs as `watchpapa` user |
| Resend SMTP | Transactional email | Configured in Supabase Auth SMTP settings |

---

## Visual Design (frontend)

Dark-first, cinematic, **refined-purple** identity. No design-token/`@theme` system and
no font change — the original `globals.css` (`#111320` bg, `#8383e7` text, Proxima
Nova→Avenir→system stack) is intact. The redesign is class-level only, using the existing
palette pushed vivid. Key recurring conventions introduced:

- **Accent.** Brand violet `#6f6fdc` (gradients/borders/focus), bright accent `#c084fc`
  (labels, "trending"), with `#8b8bff`/`#a78bfa` highlights. Cards/panels: border `#2a3570`
  (or `/50` for subtle dividers), surface `#141728`/`#12163a`, page `#111320`.
- **Primary buttons / tabs** = purple gradient `from-[#6f6fdc] to-[#4b3bb0]` + soft glow
  shadow. The shared `components/ui/Button.jsx` is this filled gradient. Active tabs
  (Watchlists, Follows) reuse it.
- **Section headings** = white text with a vertical gradient accent bar
  (`from-[#c084fc] to-[#6f6fdc]`) — see `MediaRow`, `MediaGrid`, People/Search/Watchlists.
- **Cards** (`MediaCard`, person rows, watchlist cards, cast) lift on hover
  (`-translate-y`), gain a `#6f6fdc` border + glow shadow, and posters zoom. `MediaCard`
  shows status badges (following ✓ ring, releasing-soon gold pill).
- **Home hero** = `components/home/ContentHero.jsx`: full-bleed cinematic banner built from
  the top `popular` items (blurred saturated backdrop + scrims, poster, title, CTAs,
  thumbnail strip, and a "what is watchpapa" intro panel on the right). Full-bleed uses
  `width:100vw; margin-inline: calc(50% - 50vw)`. Falls back to `HeroBanner` while loading.
- **Glass** treatment (`bg-…/70-80` + `backdrop-blur`) on the navbar, detail panels, and
  search dropdown. `InfoPageShell` styles all static/info pages (accent headings + prose).

---

## Key Conventions

- **Raw SQL only.** All DB writes use `sequelize.query()` with named `replacements:`. Never introduce Sequelize model-level CRUD.
- **Soft delete.** Always filter `deleted_at IS NULL` on queries against `movie`, `show`, `person`, `person_aka`, `profile`.
- **PK types.** `profile.id` is UUID = `auth.users.id`. All other public schema tables use `bigint` identity PKs.
- **Frontend data split.** Supabase JS client for table/RLS-gated data. `fetch()` to Express API for search, inject, resolve, rewards, referral, announcements.
- **Admin fetches.** Use `adminFetch()` helper at `Frontend/src/features/admin/adminFetch.js` — it auto-attaches the session Bearer token.
- **Analytics are consent-gated.** `trackPresence`, `trackPageView`, `trackContentClick` are no-ops if cookie consent has not been given.
- **Background ingest deduplication.** Always use `dedupIngest(key, fn)` from `ingestionQueue.js` when triggering background ingest from an API route.
- **Migrations are one-way.** Never modify an applied migration file. Create a new numbered file instead.

---

## Recent Fixes & Features

**2026-06 rating & navigation system improvements:**

- **Half-heart display fix** (`HeartDisplay.jsx`): Replaced `Math.random()` UID generation with `useId()` hook to ensure stable clipPath IDs across React 18 concurrent renders. Removed dead `Heart` component from `RatingSidebar.jsx`.
  
- **Unreleased content gating** (`RatingSidebar.jsx`, 4 detail pages): Added `isUnreleased` prop. When true (checked via date comparison: `new Date(release_date) > new Date()`), shows "Not yet released" and disables rating interaction. Applied to `MoviePage`, `ShowPage`, `SeasonPage`, `EpisodePage` using their respective date fields (`release_date`, `first_air_date`, `air_date`).

- **TMDB rating fallback** (`RatingHistogram.jsx`): When community vote count < 10, if `tmdbVoteAvg` is provided, shows TMDB's average rating (formatted to 1 decimal place) instead of "Not enough ratings yet". Applied to `MoviePage` and `ShowPage` via `tmdb_vote_avg` column. Seasons & episodes omit this prop (no TMDB column available).

- **Episode navigation** (`EpisodePage.jsx`): Added prev/next episode buttons using `season.episode` array. Finds current episode by ID, sorts by `episode_number`, renders navigation links when siblings exist. Styled as two-column hover-lift cards with arrows.

- **Season navigation** (`SeasonPage.jsx`, `useSeasonData.js`): Extended `useSeasonData` hook to fetch sibling seasons via `season(id, name, season_number)` relation in the show select query. Exposes `seasons` state; `SeasonPage` computes prev/next and renders dual navigation cards matching episode style.

- **Media share captions** (`MediaShareModal.jsx`, `generateMediaShareCard.js`): Added optional caption field (max 100 chars) in the media share modal. Users can add a short thought above the poster in the generated card. Caption text wraps across multiple lines if longer. Debounced preview generation (300ms) to prevent flickering while typing. Canvas draws quoted caption centered above poster in `#a0a0cc` color at 28px font, with ellipsis fallback on extreme overflow.

- **Adult content.** `showAdult` boolean is derived from `profile.setting_display_adult_content` and passed as a prop — not stored in React context. Include it in any query that filters `adult` content.
