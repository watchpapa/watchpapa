# CONTEXT.md — watchpapa.tv Codebase Reference

Monorepo for watchpapa.tv — a web app for tracking movie/TV show releases. Vite React frontend (`Frontend/`, Cloudflare Pages) + a Cloudflare Worker API (`worker/`, Hono). Content is read live from TMDB v3; only user data is stored (Supabase). For product narrative see `README.md`; for recent releases see `releases.md`.

---

## Tech Stack

> **2026-09 architecture change** — the TMDB content mirror is gone. Movies / shows /
> seasons / episodes / people / credits / genres are now read **live from TMDB v3**
> through a Cloudflare Worker (`worker/`), which also replaced the Express API. The
> DigitalOcean droplet, its self-hosted runner, and the ingestion scripts are
> decommissioned. User tables key on `tmdb_id`. The 15 mirror tables still exist as
> **empty scaffolding** (migration 031 `TRUNCATE`d them). See migrations 029–031 and
> the plan at `~/.claude/plans/big-job-ahead-of-crystalline-journal.md`.

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 5, React Router 7, Tailwind CSS 4 — Cloudflare Pages (`watchpapa.tv`) |
| API | **Cloudflare Worker** (`worker/`), Hono 4, JS ESM. Reads TMDB v3 live with edge caching; user data via Hyperdrive → Supabase. Served at `api.watchpapa.tv` (Worker route on the proxied A record) + `watchpapa-api.dursky-k.workers.dev` |
| Worker DB access | `postgres.js` over the `HYPERDRIVE` binding (caching disabled), raw tagged-template SQL. int8 parsed as JS number. |
| Frontend DB access | supabase-js directly (RLS-gated) for user tables; the Worker for all content + the few multi-table endpoints |
| Database | Supabase PostgreSQL (managed, `slflrvbmlrpwbndzhsjp`, eu-west-1). SSL required. |
| Auth | Supabase Auth — JWT bearer. Worker verifies **locally** via JWKS (`jose`, ES256) — no service-role round-trip. |
| Image CDN | TMDB CDN direct: `https://image.tmdb.org/t/p/{size}{path}`. `Frontend/src/lib/tmdbImage.js` builds URLs. Canvas/share cards go through the Worker `/api/image-proxy`. |
| CI/CD | Cloudflare Pages git build (`watchpapa`, `production` branch) + Cloudflare Workers Builds (`watchpapa-api`, `production`, root `worker/`). `.github/workflows/deploy-worker.yml` is a manual-dispatch backup. |
| Email | Supabase Auth SMTP via Resend |
| Testing | Worker: `vitest` (`worker/test/`). Root: `node --test` (`tests/rls_tests/`), pytest (`tests/test_environment.py`). |

---

## Repository Layout

```
watchpapa/
├── package.json                      # root: DB-migration home + RLS tests only (test:rls, test:py)
├── worker/                           # ── Cloudflare Worker API (Hono) ──
│   ├── wrangler.jsonc                # bindings: HYPERDRIVE, RL_GLOBAL/RL_MUTATION; route api.watchpapa.tv/*
│   ├── src/
│   │   ├── index.js                 # Hono app — CORS, rate limits, route mounts, error handlers
│   │   ├── env.js                   # parse wrangler vars → typed caps (BATCH_MAX, etc.)
│   │   ├── db.js                    # getSql(c) / withSql(c, fn) — postgres.js over HYPERDRIVE, int8→number
│   │   ├── auth.js                  # requireAuth (jose JWKS, ES256) / requireAdmin / requireEditor
│   │   ├── audit.js                 # auditLog(action, fields) → executionCtx.waitUntil INSERT
│   │   ├── ratelimit.js             # RL_GLOBAL / RL_MUTATION wrappers (no-op if binding absent)
│   │   ├── tmdb/
│   │   │   ├── client.js            # tmdbFetch(env, path, params, {ttl, language}) — fetch + cf cache + 429 retry
│   │   │   ├── normalize.js         # TMDB payloads → the field names the UI reads (id === tmdb_id); native-title swap, regional release date, watch-provider compaction, NSFW flag
│   │   │   ├── lists.js             # list-kind → TMDB endpoint (or a /discover spec) + TTL map
│   │   │   ├── locale.js            # readLocale(c) — parses/validates lang/region/native/include_adult/providers query params
│   │   │   ├── nsfw.js              # NSFW_KEYWORD_IDS / NSFW_TITLE_RE / NSFW_ALLOW_IDS / isNsfw() / filterNsfw() — single tunable module for adult-flag-evading content
│   │   │   └── discover.js          # discoverParams() + runDiscover() — shared /discover/{movie,tv} builder (popular/top-rated list kinds, coming-soon, "available on your services", /discover/:type)
│   │   ├── routes/
│   │   │   ├── content.js           # /api/content/* — detail, list, discover, genres, watch/regions, watch/providers, config/locales, POST batch, POST releases
│   │   │   ├── publicContent.js     # /api/search, /api/posters, /api/image-proxy, /sitemap*.xml
│   │   │   ├── referral.js  rewards.js  announcements.js  import.js
│   │   │   └── admin/{index,users,stats,rewardCodes,referrals,auditLog,announcements}.js
│   │   └── lib/{letterboxdUri,csv}.js
│   └── test/                        # vitest — normalize / csv / nsfw / locale / client / discover fixtures
├── Backend/src/db/migrations/        # 001–031 SQL — apply via Supabase MCP (only thing left under Backend/)
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
│   │   ├── content/                  # ── all TMDB-content reads go through here ──
│   │   │   ├── hooks/useContent.js   # useMovie/useShow/useSeason/useEpisode/usePerson/useContentList/useDiscover/useGenres — cache keyed by `${localeKey}|${path}`
│   │   │   ├── hooks/useContentBatch.js  # POST /api/content/batch — hydrate cards for user-data rows; cache keyed by `${localeKey}:${cardKey}`
│   │   │   ├── hooks/useMediaBrowse.js   # shared engine for /movies + /shows (popular + coming-soon + genre rows + "Available on your services" row)
│   │   │   └── lib/keys.js           # cardKey(item), itemFromRow(row) — map a (media_type, tmdb_id) row to a batch item
│   │   ├── preferences/              # ── content-locale + streaming preferences ──
│   │   │   ├── PreferencesContext.jsx    # PreferencesProvider (wraps the route tree in App.jsx) / usePreferences() — showAdult, language, titleMode, region, watchRegions, watchProviders; update() writes profile + refreshes live
│   │   │   └── hooks/useWatchProviderCatalog.js  # useLocaleCatalog / useWatchRegionCatalog / useWatchProviderList / languageLabel()
│   │   ├── person/lib/filmography.js # mergeCredits/sortCredits/filterCredits/departmentsOf — PersonPage filmography sort+filter
│   │   └── admin/hooks/              # useAdminAnnouncements, useIsAdmin, … (via adminFetch.js Bearer helper)
│   ├── features/watchlist/hooks/     # useWatchlistItems (selects tmdb_id, hydrates via useContentBatch), useItemWatchlistStatus
│   ├── features/rating/hooks/        # useRating(mediaType, tmdbId, session, {tmdbShowId,seasonNumber,episodeNumber}), useCommunityRatings(mediaType, tmdbId)
│   ├── features/profile/hooks/       # useProfileData(username, session), useProfileRatings(profileId), useProfileStats(profileId, ownerTier), useEditProfile(session), useProfileRecapStats(profileId, tier) — fetches last 30 days of user_rating and aggregates into weekly/monthly windows client-side
│   ├── features/follows/hooks/       # useFollows(session), useOverageStatus(session, refreshKey) — NOTE: ReleasesCalendarPage and FollowsPage derive overage live from reactive arrays instead of calling this hook
│   ├── components/
│   │   ├── watchlist/                # AddToWatchlistButton — auto-adds to first list, toast + checklist picker (multi-list); compact prop for WatchlistsPage
│   │   ├── rating/                   # HeartDisplay, RatingInput, RatingButton, RatingSidebar (always-visible sidebar widget), RatingHistogram (bar tooltips on hover)
│   │   ├── profile/
│   │   │   ├── generateShareCard.js  # Canvas 2D renderer for 4K share cards (story 9:16, square 1:1, wide 16:9); tier-gated layouts + personality emoji; scale param for preview (1x) vs download (3x). Exports generateRecapShareCard(format, recapData, profileData, scale) for weekly/monthly recap cards
│   │   │   ├── ProfileShareModal.jsx # Format picker (3 pills), cardType selector (Profile/Weekly/Monthly), WYSIWYG preview (canvas at 1x scale), Download PNG + Share (Web Share API mobile, fallback download on desktop). Recap tabs only show if recapStats has data
│   │   │   └── AvatarPicker.jsx      # Avatar section on /profile/edit — initials (default, any tier) / TMDB movie poster (any tier, via MediaSearchModal, movies only) / cropped photo upload (Pro+ only, react-easy-crop) — see useEditProfile.js
│   │   │   # Also: ProfileFavourites, FavouritesEditor, ProfileStats (tier-gated blur), ProfileRatingCard
│   │   ├── detail/
│   │   │   ├── generateMediaShareCard.js # Canvas generator for movie/show share cards (3 formats: story 9:16, square 1:1, wide 16:9; 3 detail levels: minimal/standard/rich). Loads poster via TMDB + logo, renders hearts if user rated
│   │   │   └── MediaShareModal.jsx # Format + detail level selectors (pill buttons), live preview, Download (4K) + Share buttons. Internally calls useRating to fetch user's rating for the media
│   │   ├── layout/                   # Navbar, Footer, Breadcrumbs, ProfileMenu (hover→dropdown desktop / click→profile; click→dropdown mobile), PosterBackground
│   │   ├── ui/                       # Button, Input, Toggle, Select, Avatar, MediaSearchModal (movie/show search picker, shared by FavouritesEditor [both] + AvatarPicker [movies only]), OtpInput, PageHead, RichTextEditor, OverLimitBanner, …
│   │   ├── detail/                   # DetailPageLayout, PosterCard, CastGrid, FollowButton (blockedLabel prop), WhereToWatch (streaming-provider panel), AdminResyncButton (admin-only, role 4; shown on Movie/Show/Person pages), …
│   │   ├── home/                     # MediaCard, MediaGrid, MediaRow, SearchBar
│   │   ├── auth/                     # AdminRoute (route guard)
│   │   ├── subscription/             # EarlyAdopterBanner, UpgradePromptToast
│   │   └── static/                   # InfoPageShell
│   └── lib/
│       ├── supabase.js               # Supabase JS client (anon key, consent-aware storage)
│       ├── api.js                    # apiFetch(path, {session}) + API_BASE — calls the Worker
│       ├── tmdbImage.js              # tmdbImg(path, size) / tmdbImgProxied(...) — replaces 21 hard-coded URLs
│       ├── credits.js                # toCast/toCrew — shape the Worker's flat cast/crew arrays
│       ├── followGate.js             # movieFollowBlock/showFollowBlock/followBlock — blocks NEW follows of released movies/finished shows (existing follows untouched); movieLifecycleLabel/showStatusInfo chips for FollowsPage
│       ├── tier.js  cropImage.js  avatarUrl.js  # avatar support: isProTier()/isPremiumTier(); getCroppedImageBlob() (react-easy-crop pixel-crop → square JPEG Blob); avatarUploadUrl(path) (Supabase Storage public URL, sync)
│       ├── cookieConsent.js  cn.js  validate.js  constants.js
├── tests/rls_tests/                  # RLS policy tests (node --test) — retarget follow inserts to tmdb_id
├── .github/workflows/deploy-worker.yml  # manual-dispatch backup; primary deploy = Cloudflare Workers/Pages Builds
└── docs/                             # (gitignored) architecture/security deep-dives — mostly pre-migration
```

---

## Environment Variables

**Backend (root `.env`):**

**Worker** — `wrangler.jsonc` `vars`: `ALLOWED_ORIGINS`, `SUPABASE_URL` (for JWKS), `BATCH_MAX`, `BATCH_SUBREQ_BUDGET`, `IMPORT_CHUNK_MAX`, `RELEASES_MAX_SHOWS`, `SITEMAP_PAGES`. Secret (`wrangler secret put`): `TMDB_API_KEY_SECRET`. Binding: `HYPERDRIVE`. Local dev also needs the shell var `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` (= the Supabase pooler URL) + `worker/.dev.vars` with `TMDB_API_KEY_SECRET`.

**Frontend** — Pages production env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`), **`VITE_API_BASE_URL=https://api.watchpapa.tv`** (must be set — the frontend calls the Worker cross-origin). Local dev: `Frontend/.env` + `vite.config.js` proxies `/api` → `localhost:8787`.

**RLS tests** — root `.env`: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY_SECRET`.

---

## API Route Map (Worker — `worker/src/`)

**Locale contract** — every `/api/content*` and `/api/search*` route accepts these query params (parsed by `tmdb/locale.js` `readLocale(c)`); the Frontend appends them automatically (see TMDB Content Architecture below), so most call sites never build them by hand:

| Param | Example | Effect |
|---|---|---|
| `lang` | `pl-PL` | TMDB `language` (validated `xx-YY`, default `en-US`) |
| `region` | `PL` | Regional release-date pick (movie detail/batch) + forwarded to TMDB `region`/`watch_region` on discover/list-window endpoints |
| `native` | `pl` | Swap the display title to the TMDB original title when `original_language` matches (mode B: "original titles for my language, English for the rest") |
| `include_adult` (or `includeAdult`) | `true` | Unfiltered results; also gates the NSFW-keyword/title layer (`tmdb/nsfw.js`) |
| `providers` | `8\|337` | `with_watch_providers` on `/discover/:type` (pipe-separated TMDB provider ids, requires `watch_region`) |

**Content** (public, edge-cached — `routes/content.js` + `routes/publicContent.js`):

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/content/movie/:id` · `/show/:id` · `/show/:id/season/:n` · `/show/:id/season/:n/episode/:m` · `/person/:id` | `:id` = TMDB id. `append_to_response` credits/aggregate_credits/combined_credits + `release_dates,keywords,watch/providers` (movie/show). One extra en-US fetch fills `overview`/`tagline` when the requested language has no translation (TMDB returns those empty, not falling back) |
| `GET` | `/api/content/list/:kind?page&include_adult` | kind ∈ movies-popular / shows-popular / movies-top-rated / … (see `tmdb/lists.js`). Popular/top-rated kinds are **served via `/discover/*`** (not the raw TMDB list endpoint) so `include_adult`, NSFW-keyword exclusion, language and region all apply — TMDB's list endpoints ignore `include_adult` entirely |
| `GET` | `/api/content/discover/:type?with_genres&upcoming&page&with_watch_providers&watch_region&with_watch_monetization_types` | `:type` = movie \| tv — powers genre rows, "coming soon", and the "Available on your services" row |
| `GET` | `/api/content/genres` | `{movie:[], tv:[]}` |
| `GET` | `/api/content/watch/regions?lang=` | `{regions:[{code,name,nativeName}]}` — TMDB `/watch/providers/regions` |
| `GET` | `/api/content/watch/providers?type=movie\|tv\|all&region=` | `{region, providers:[{id,name,logo_path,priority}]}` — TMDB `/watch/providers/{movie,tv}`, merged + priority-sorted for `type=all` |
| `GET` | `/api/content/config/locales?lang=` | `{languages:["en-US",…], countries:[{code,name,nativeName}]}` — TMDB `/configuration/primary_translations` + `/configuration/countries`; backs the Settings language/country pickers |
| `POST` | `/api/content/batch` | `{items:[…]}` → `{cards, missing}` — card hydration; movie items append `release_dates,keywords`, show items append `keywords` |
| `POST` | `/api/content/releases` | `{showIds, year, month}` → episode air dates |
| `GET` | `/api/search?q=&include_adult=` (also accepts `includeAdult=`) | TMDB multi-search → `{results:[{type,tmdbId,title,originalTitle,posterPath,year,adult,nsfw}]}` |
| `GET` | `/api/posters` | 80 popular poster paths (auth-page wall) |
| `GET` | `/api/image-proxy?path=&size=` | streamed, CORS, edge-cached — for canvas/share cards |
| `GET` | `/sitemap.xml` · `/sitemap-{static,movies,shows,people}.xml` | from TMDB lists, 24h cache |
| `GET` | `/health` | `{status:"ok"}` |

**User data** (`routes/referral.js`, `rewards.js`, `announcements.js`, `import.js`, `admin/*`):

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/referral/use/:code` | JWT + mutation limit + audit | |
| `POST` | `/api/rewards/claim` | JWT + mutation limit + audit | `sql.begin()` transaction |
| `GET`/`POST`/`PATCH` | `/api/announcements[/…]` | public GET; JWT + requireEditor writes | SQL on `announcements` |
| `POST` | `/api/import/resolve` | JWT | `{items:[{name,year,uri?}]}` ≤ IMPORT_CHUNK_MAX → `{resolved:[{tmdbId,…}], unresolved}`. No DB writes |
| `POST` | `/api/import/commit` | JWT | insert `user_rating` / `watchlist_item` by `tmdb_id`; `WATCHLIST_LIMIT_REACHED → 422` |
| `GET` | `/api/import/export` | JWT | **JSON** `{ratings, watchlistItems}` keyed by tmdb_id — frontend composes the CSV |
| `*` | `/api/admin/{users,stats,reward-codes,referrals,audit-log,announcements}/*` | JWT + requireAdmin (role 4) | |

Dropped vs the old Express API: `/api/inject`, `/api/resolve`, `/api/import/run`, `/api/import/sync-status`, `/api/admin/resync`, `/api/admin/script-logs`, `/api/admin/stats/queue`.

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
| `/movies/:id` | Public | `MoviePage` | `:id` = TMDB id (everywhere now) |
| `/shows` | Public | `ShowsPage` | |
| `/shows/:id` | Public | `ShowPage` | |
| `/shows/:id/seasons/:seasonNumber` | Public | `SeasonPage` | |
| `/shows/:id/seasons/:seasonNumber/episodes/:episodeNumber` | Public | `EpisodePage` | |
| `/{movies,shows,people}/tmdb/:tmdbId` | Public | `TmdbRedirect` | legacy → `<Navigate>` to `/{kind}/:tmdbId` |
| `/people` | Public | `PeoplePage` | |
| `/people/:id` | Public | `PersonPage` | |
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

**Content tables** — `movie`, `show`, `season`, `episode`, `person`, `person_aka`, `genres`, `department`, `job`, `movie_credits`, `show_credits`, `episode_credits`, `movie_genre`, `show_genre`, `script_logs` still exist but are **empty** (migration 031 `TRUNCATE`d them; schema/indexes/RLS/`tmdb_id` unique constraints kept). Nothing reads or writes them — all content is live from TMDB via the Worker.

**User / auth tables** — content is now referenced by **`tmdb_id`**, not a local FK:

| Table | PK | Key columns | Notes |
|---|---|---|---|
| `profile` | `uuid` (= `auth.users.id`) | `username` (unique, nullable), `role`, `bio`, `date_of_birth` (nullable), `setting_display_adult_content`, `referral_code`, `email_marketing_opt_in`, `setting_language` (default `en-US`), `setting_title_mode` (`translated`\|`native_original`), `setting_region` (nullable ISO 3166-1), `setting_watch_regions` (`TEXT[]`, ≤5), `setting_watch_providers` (`INTEGER[]`, ≤50), `avatar_type` (`default`\|`poster`\|`upload`), `avatar_poster_media_type`/`avatar_poster_tmdb_id`/`avatar_poster_path`, `avatar_upload_path` | role: 0=user, 3=editor, 4=admin |
| `user_rating` | `bigint` identity | `profile_id`, `media_type` ('movie'\|'show'\|'season'\|'episode'), `tmdb_id`, `tmdb_show_id`+`season_number`(+`episode_number`) for season/episode, `value` (1–10) | UNIQUE `(profile_id, media_type, tmdb_id)`. RLS read via `can_view_ratings()`. |
| `profile_favourite` | `bigint` identity | `profile_id`, `position` (1–5), `media_type`, `tmdb_id` | UNIQUE `(profile_id, position)` |
| `user_followed_movies` | `bigint` identity | `profile_id`, `tmdb_id` | UNIQUE `(profile_id, tmdb_id)` |
| `user_followed_shows` | `bigint` identity | `profile_id`, `tmdb_id` | UNIQUE `(profile_id, tmdb_id)` |
| `user_subscriptions` | `uuid` | `profile_id`, `tier`, `is_early_adopter`, `expires_at`, `ea_banner_dismissed` | Use `get_effective_tier()` RPC — never raw `tier` |
| `reward_codes` | `uuid` | `code`, `tier`, `duration_days`, `max_uses`, `is_active` | |
| `reward_code_claims` | `uuid` | `code_id`, `profile_id` | Prevents duplicate claims |
| `referrals` | `uuid` | `referrer_id`, `referred_id` (unique) | |
| `audit_events` | `uuid` | `action`, `user_id`, `ip`, `method`, `path`, `body`, `created_at` | Written by `auditLog` middleware |
| `announcements` | `uuid` | `title`, `body`, `archived`, `author_id`, `archived_by`, `archived_at` | |
| `watchlist` | `bigint` identity | `profile_id`, `name`, `created_at`, `updated_at` | Per-tier limit enforced by `enforce_watchlist_limit` trigger |
| `watchlist_item` | `bigint` identity | `watchlist_id` FK, `media_type` ('movie'\|'show'), `tmdb_id`, `watched`, `added_at` | UNIQUE `(watchlist_id, media_type, tmdb_id)`. Rating an item auto-removes it. |

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
| 029 | `tmdb_ids` | **TMDB-live migration, Phase 2 (applied 2026-09-03, additive).** Adds `media_type`/`tmdb_id` (+ `tmdb_show_id`/`season_number`/`episode_number` for season+episode ratings) to `user_rating`, `watchlist_item`, `profile_favourite`, `user_followed_movies`, `user_followed_shows`; backfills all from the content tables (0 unmapped). New plain-unique indexes `*_media_uniq` / `*_profile_tmdb_uniq` for PostgREST onConflict. Adds `get_activity_feed_v2(int,int)` (content-join-free; distinct name to avoid overload ambiguity with the all-default-arg 3-arg version). Unschedules the stale `cleanup-analytics` pg_cron job. **Nothing dropped — old columns/CHECKs/indexes/functions all intact.** |
| 030a | `drop_xor_checks` | **Applied 2026-09-03.** Drops `user_rating_one_media` / `watchlist_item_one_media` / `profile_favourite_one_media` CHECKs so the new frontend can write `(media_type, tmdb_id)`-only rows. Split from 030 for Phase 3 dev testing; old frontend unaffected. |
| 030 | `swap_functions` | **Applied 2026-09-03 (cutover).** `CREATE OR REPLACE` `get_community_rating_stats` / `get_observed_ratings_for_entity` / `audit_user_follow_change` to key on `tmdb_id`. `030_swap_functions_down.sql` reverses it (rollback path until 031). |
| 031 | `clear_content` (**pending — after soak**) | Re-backfill stragglers, NOT NULL + replacement CHECKs, **drop the old id columns** (`user_rating.movie_id`/`show_id`/`season_id`/`episode_id`, etc. — their FKs would block the truncate), drop `get_activity_feed(int,int,bool)` + `get_profile_genre_stats`, rename `get_activity_feed_v2` → `get_activity_feed`, then **`TRUNCATE … CASCADE` the 15 mirror tables** (`movie`/`show`/`season`/`episode`/`person`/`person_aka`/`genres`/`department`/`job`/`*_credits`/`*_genre`/`script_logs`) — schema/indexes/RLS/`tmdb_id` constraints kept as empty scaffolding, ~1.3 GB reclaimed. Irreversible for the row data (but it's all re-fetchable from TMDB). |
| 032 | `locale_and_watch_settings` | Adds `setting_language`, `setting_title_mode`, `setting_region`, `setting_watch_regions`, `setting_watch_providers` to `profile` (with format CHECKs). Purely additive; no RLS change needed — `profile_update_own` already covers the whole row and 010's REVOKE only touches `role`/`referral_code`. |
| 033 | `profile_avatars` | Adds `avatar_type`/`avatar_poster_media_type`/`avatar_poster_tmdb_id`/`avatar_poster_path`/`avatar_upload_path` to `profile`. New `guard_profile_avatar_tier` BEFORE UPDATE trigger (same pattern as 010) blocking `avatar_type='upload'` below Pro. Creates the public `avatars` Storage bucket (5MB limit, image/jpeg\|png\|webp) with `storage.objects` RLS scoped to `bucket_id='avatars'` (insert/update require the caller's own `${uid}/` folder + Pro+ tier via `get_effective_tier`; delete needs only the own-folder check). Drops + recreates `search_profiles`/`get_observers`/`get_observing` (return-type change) to add `avatar_type`/`avatar_poster_path`/`avatar_upload_path` to their output. |
| 034 | `watch_providers_tier_gate` | New `guard_profile_watch_providers_tier` BEFORE UPDATE trigger (same pattern as 033) blocking a non-empty `setting_watch_providers` below Pro. `setting_watch_regions` is unaffected — still open to every tier. |

To add the next migration: create `Backend/src/db/migrations/035_<name>.sql`, apply via `mcp__claude_ai_Supabase__apply_migration`.

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
- Content preferences (`showAdult`, language, title mode, region, watch regions/providers) live in `features/preferences/PreferencesContext.jsx` — `PreferencesProvider` wraps the route tree (extracted into `RouteTree` in `App.jsx` so it can consume the context App itself renders), seeded from the same profile fetch, remounted via a `key={session?.user?.id}` on sign-in/out. `usePreferences().update(partial)` writes straight to `profile` and updates every consumer immediately — fixes the old bug where toggling adult content in Settings needed a reload to take effect. `showAdult` is still passed down as a prop from `RouteTree` to match existing page signatures.
- Storage is consent-aware: `localStorage` if cookie consent accepted, `sessionStorage` otherwise.

**Worker (per-request), `worker/src/auth.js`:**
- `requireAuth`: verifies the Bearer JWT **locally** against the Supabase JWKS (`jose`, ES256; issuer `${SUPABASE_URL}/auth/v1`, audience `authenticated`). No network round-trip. Sets `c.get('user') = { id: sub, email }`.
- `requireAdmin`: `SELECT role FROM public.profile WHERE id = $1` over Hyperdrive; requires `role = 4` (int8 is parsed as a JS number — see `db.js`).
- `requireEditor`: same, `role IN (3, 4)`.

---

## TMDB Content Architecture

**No mirror.** All movie/show/season/episode/person/credit/genre data is fetched **live from TMDB v3** by the Worker (`worker/src/tmdb/client.js` → `fetch(url, { cf: { cacheEverything, cacheTtl } })`, per-endpoint TTLs 6h–7d) and normalized (`normalize.js`) into the exact field names the UI reads — `id === tmdb_id`, season/episode `still_path` aliased to `poster_path`, `aggregate_credits` roles[]/jobs[] flattened.

- **Detail:** `GET /api/content/{movie,show,season,episode,person}/:id`
- **Browse:** `GET /api/content/{list/:kind,discover/:type,genres}` — `movies-popular`/`movies-top-rated`/`shows-popular`/`shows-top-rated` are **served through `/discover/*`** (`tmdb/discover.js` `discoverParams`/`runDiscover`, shared by `/list/:kind`, `/discover/:type`, and the coming-soon/"available on your services" fetches) rather than TMDB's `/movie/popular` etc., because those list endpoints ignore `include_adult` and have no keyword-exclusion param. Other kinds map straight to a TMDB list path in `lists.js`.
- **Card hydration:** `POST /api/content/batch` `{items:[{type,id,showId?,seasonNumber?,episodeNumber?}]}` → `{cards, missing}` — used to attach title/poster/date/genres to user-data rows (`user_rating`, `watchlist_item`, favourites, follows) that store only `(media_type, tmdb_id)`. Frontend: `features/content/hooks/useContentBatch.js` + `lib/keys.js`.
- **Calendar:** `POST /api/content/releases` `{showIds,year,month}` → episode air dates for followed shows (bounded ≤3 TMDB calls/show).
- Free-plan caps (50 subrequests / 10 ms CPU per request) are `wrangler.jsonc` `vars` (`BATCH_MAX`, `BATCH_SUBREQ_BUDGET`, `RELEASES_MAX_SHOWS`, `SITEMAP_PAGES`, `IMPORT_CHUNK_MAX`).
- **Sitemaps** (`worker/src/routes/publicContent.js`): built from TMDB popular + top-rated list pages, cached 24h. `Frontend/public/_redirects` 301s `/sitemap*.xml` → `api.watchpapa.tv`.

The 15 mirror tables still exist as **empty scaffolding** (migration 031 `TRUNCATE`d them, kept schema/indexes/RLS/`tmdb_id` constraints). Nothing reads or writes them.

### Content locale (language / title mode / region)

- `worker/src/tmdb/client.js` `buildUrl(path, params, apiKey, language)` sets `api_key`, then `language` (default `en-US`), then `params` — **that order is load-bearing**: Cloudflare's edge cache keys on the full URL, so a distinct `language`/any `params` key naturally partitions the cache with zero extra work. Never add `region` to a non-window TMDB call (tv/person/season/episode) — it would fragment those caches for nothing; `region` only matters where TMDB itself uses it (movie discover/list-window endpoints) or where the Worker picks a date out of an already-fetched `release_dates` payload.
- `worker/src/tmdb/locale.js` `readLocale(c)` parses/validates `lang`/`region`/`native`/`include_adult`/`providers` off the request (see API Route Map above) into `{ language, region, native, includeAdult, providers }`, passed to `tmdbFetch(..., { language })` and to every `normalize.js` function as its trailing `opts`.
- **Native-title mode** (`opts.native`, an ISO 639-1 code): `normalize.js` `pickTitle()` swaps the display title for TMDB's `original_title`/`original_name` when `original_language === native` — e.g. a Polish user in "original titles for my language" mode sees Polish films with their Polish title and everything else in English. The Frontend derives this: title mode `native_original` sends `lang=en-US&native=<language's ISO 639-1 part>`; `translated` sends `lang=<language>` only.
- **Missing translations:** TMDB falls back `title`→`original_title` automatically, but returns `overview`/`tagline` as **empty strings** with no fallback. Movie/show detail routes do one extra en-US `tmdbFetch` (same `append_to_response` shape as the batch route, so it shares that cache entry) to fill `overview`/`tagline` when the requested language came back empty, flagged `overview_fallback: "en-US"` on the response.
- **Regional release dates:** movie detail + movie `/batch` cards append `release_dates`; `normalize.js` `pickRegionalRelease()` picks the earliest date for the user's `region` preferring theatrical (type 3) > limited theatrical (2) > digital (4) > TV (6). Movie payloads expose `release_date` (TMDB primary, unchanged), `release_date_regional` (or `null`), and `release_date_effective` (regional ?? primary) — `lib/followGate.js` and the "Not yet released" gates use the effective date. List/discover card rows have no per-item `release_dates` append, so their `date` stays the TMDB primary date.
- **Frontend plumbing:** `features/preferences/PreferencesContext.jsx` derives `{ lang, region, native }` from the user's saved preferences and calls `lib/api.js` `setContentLocale()` **synchronously during the provider's render** (not in a `useEffect` — that would race the first content fetch under the stale/default locale). `apiFetch()` appends `lang`/`region`/`native` to every `/api/content*` and `/api/search*` request automatically. Because that happens inside `apiFetch` rather than in each hook's own path-building, `features/content/hooks/useContent.js` and `useContentBatch.js` prefix their module-level caches with `usePreferences().localeKey` (`useContent`: `` `${localeKey}|${path}` ``; `useContentBatch`: `` `${localeKey}:${cardKey}` ``) so a locale switch can't serve stale-language data back out of those caches.

### Watch providers ("Where to watch")

- Movie/show detail + `/batch` append `watch/providers`; `normalize.js` `compactWatchProviders()` reshapes TMDB's ~50-region payload into `{ providers: {id:{name,logo_path}}, regions: {ISO:{link,flatrate:[ids],rent:[ids],buy:[ids],free:[ids],ads:[ids]}} }` — provider metadata is deduped once instead of repeated per region.
- New routes `GET /api/content/watch/regions` and `GET /api/content/watch/providers?type=movie|tv|all&region=` wrap TMDB's `/watch/providers/{regions,movie,tv}` for the Settings pickers (`features/preferences/hooks/useWatchProviderCatalog.js`).
- `components/detail/WhereToWatch.jsx` renders the panel on `MoviePage`/`ShowPage` (region tabs from the user's `setting_watch_regions` — open to every tier). `features/content/hooks/useMediaBrowse.js` (`/movies`/`/shows`) and `features/home/hooks/useHomeData.js` (`/`, row titled "Popular on my streamings") both add an "Available on your services" row via `/discover/:type?with_watch_providers=&watch_region=&with_watch_monetization_types=flatrate|free|ads`, shown only once the user has picked providers — which, being Pro+ only (below), means the row itself is implicitly Pro+ only with no extra gating needed at the row level.
- **Choosing specific providers ("My streaming services" in Settings, `setting_watch_providers`) is Pro/Pro+/God only** — watch **regions** stay open to everyone (migration 034 `guard_profile_watch_providers_tier` trigger; `SettingsPage.jsx` shows an upgrade prompt instead of the provider grid below Pro). Browsing a region's full "Where to watch" listing was never gated — only marking *which* providers are yours (highlighting + the "Popular on my streamings" / "Available on your services" rows) is.
- **JustWatch attribution is mandatory** per TMDB's terms — every surface showing provider data (Settings provider grid, `WhereToWatch`) credits JustWatch (`lib/constants.js` `JUSTWATCH_ATTRIBUTION_URL`).
- **No subtitle/audio-language data is available.** TMDB's watch-provider integration (sourced from JustWatch) only returns `{provider_id, provider_name, logo_path, display_priority}` per region/bucket — nothing about which language tracks a given platform offers for a given title in a given region. That data isn't exposed by TMDB's free API at all (JustWatch's own paid Partner API has it, TMDB's integration doesn't). Not implementable without a different, paid data source.

### NSFW filtering beyond the `adult` flag

TMDB's `adult` flag misses softcore/erotica titles that are only tagged via keywords. `worker/src/tmdb/nsfw.js` is the single tunable module: `NSFW_KEYWORD_IDS` (a deliberately narrow curated set — porn/softcore/hentai/pink-film/sexploitation-style ids only, **not** generic keywords like "nudity" that hit mainstream titles), `NSFW_TITLE_RE` (a title-only regex fallback), and `NSFW_ALLOW_IDS` (per-type id allowlist for known regex false positives). `isNsfw(raw, type)` = `adult || keyword hit || (not allowlisted && title regex hit)`; `filterNsfw(rows, includeAdult, type)` applies it. Wired in: `/discover/*` (`without_keywords` pipe-joined ids sent to TMDB **and** a Worker-side `filterNsfw` post-filter, since TMDB's own list endpoints ignore it), `/list/:kind`, `/api/search` (`normalizeSearchResults`), `/batch` and detail routes (`nsfw` field on cards/movie/show/person-credits). Frontend detail gates and `usePersonData`/`useActivityFeed` treat `adult || nsfw` as restricted, same as the plain `adult` check before.

### User avatars

Three `profile.avatar_type` values, no Worker involvement — all pure Frontend + Supabase Storage (migration 033):

- **`default`** — the username's first letter on a plain circle, same as the app always showed (an earlier generated-identicon pattern was tried and dropped — not liked, reverted to plain initials).
- **`poster`** — any tier can pick a **movie** poster as their avatar via `components/ui/MediaSearchModal.jsx` (`mediaTypes={["movie"]}`; the same component defaults to movies+shows for `FavouritesEditor.jsx`, which still allows both); stores `avatar_poster_media_type`/`avatar_poster_tmdb_id`/`avatar_poster_path`, rendered via the existing `tmdbImg()`.
- **`upload`** — a custom cropped photo, **Pro/Pro+/God only**. `components/profile/AvatarPicker.jsx` opens a `react-easy-crop` crop-and-zoom modal, `lib/cropImage.js` `getCroppedImageBlob()` renders the crop to a 512×512 canvas → JPEG Blob, uploaded to the public `avatars` Supabase Storage bucket at `${uid}/${Date.now()}.jpg` (a fresh filename per upload so the CDN URL always cache-busts; old objects aren't cleaned up — cheap enough at Pro-only volume for now). Tier is enforced **server-side twice**, never trusting the client: the `guard_profile_avatar_tier` trigger on `profile` (rejects the row update) and the `avatars` bucket's `storage.objects` RLS (rejects the upload itself) both call `get_effective_tier()`. A later downgrade does not retroactively clear an existing upload.
- `components/ui/Avatar.jsx` (takes `username` + the three avatar_* fields, not a user id — the identicon that used it was removed) is the single renderer used everywhere an identity shows: `ProfileMenu` (own nav, fetched eagerly so it's visible on the closed button), `ProfilePage` header, and `UserResultRow` (search/observer lists — `search_profiles`/`get_observers`/`get_observing` RPCs were extended to return the three avatar columns). It is **not** wired into the activity feed or "who rated this" panel — neither shows any identity avatar today (not even initials), and both are backed by SQL RPCs (`get_activity_feed_v2`, `get_observed_ratings_for_entity`) that would need their own migration to add the columns; left as a follow-up.
- `lib/tier.js` `isProTier()`/`isPremiumTier()` is a new shared helper for tier-gated UI — introduced here since avatar upload needed one; the four pre-existing ad hoc tier-check duplicates (`ProfileStats.jsx`, `useProfileStats.js`, `generateShareCard.js`, `ProfileShareCard.jsx`) were left as-is (unrelated to this feature).

---

## CI/CD & Deployment

| Target | Mechanism | Trigger |
|---|---|---|
| Frontend (`watchpapa` Pages) | Cloudflare Pages git build — `cd Frontend && npm run build`, publish `Frontend/dist` | push to `production` |
| Worker (`watchpapa-api`) | Cloudflare Workers Builds — root `worker/`, `npx wrangler deploy` | push to `production` |
| Worker (backup) | `.github/workflows/deploy-worker.yml` — `npm ci && npm test && wrangler deploy` | `workflow_dispatch` only |

**Pages production env vars** (dashboard): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, **`VITE_API_BASE_URL=https://api.watchpapa.tv`** (the frontend calls the Worker cross-origin directly — the `_redirects` `/api/*` proxy does not forward).

**Worker secret** (`wrangler secret put`): `TMDB_API_KEY_SECRET`. **Worker binding**: `HYPERDRIVE` id `1b02c04c106949288724ad2a003ee046` (→ Supabase session pooler, caching disabled).

**deploy-worker.yml GitHub secrets** (if used): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

**Production:** Frontend `https://watchpapa.tv` (Pages). API `https://api.watchpapa.tv` (Worker route on the still-proxied A record; also `watchpapa-api.dursky-k.workers.dev`). No origin server — the droplet is decommissioned.

---

## Common Workflow Patterns

**New app feature page:**
1. Page component → `Frontend/src/pages/app/`; domain hook → `Frontend/src/features/<domain>/hooks/`
2. Register route in `App.jsx`
3. Content data → the content hooks in `features/content/hooks/` (never a content table)
4. User data → `supabase` client in the hook (RLS-gated), keyed by `tmdb_id`
5. Worker data → `apiFetch(path, { session })` from `Frontend/src/lib/api.js`

**New admin feature:**
1. Worker route → `worker/src/routes/admin/<name>.js` (Hono sub-app), mount in `admin/index.js`
2. Frontend hook → `Frontend/src/features/admin/hooks/` using `adminFetch(path, options)`
3. Page → `Frontend/src/pages/admin/`, register as nested child of `/admin` in `App.jsx`

**New content endpoint (Worker):**
1. Route → `worker/src/routes/content.js` (or a new file mounted in `index.js`)
2. TMDB call via `tmdbFetch(env, path, params, { ttl })`; shape the response in `tmdb/normalize.js`
3. Watch the Free-plan subrequest budget; add a cap `var` if it can fan out

**Worker user-data endpoint:**
1. Route file → `worker/src/routes/`, mount in `index.js`
2. `return withSql(c, async (sql) => { const rows = await sql\`SELECT ...\`; ... })` — raw tagged-template SQL, `sql.begin()` for transactions
3. `requireAuth` / `requireAdmin` / `mutationRateLimit` / `auditLog(...)` middleware as needed

**Schema change (new migration):**
1. Create `Backend/src/db/migrations/032_<name>.sql`
2. Apply via `mcp__claude_ai_Supabase__apply_migration`
3. Update the Migration History table in this file

---

## External Integrations

| Service | Role | Config |
|---|---|---|
| TMDB API v3 | Live content source | `TMDB_API_KEY_SECRET` (Worker secret); all calls via `worker/src/tmdb/client.js` |
| Supabase Auth | Email/OTP + OAuth, JWT issuance | Worker verifies JWTs locally via JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, ES256); `VITE_SUPABASE_*` (frontend) |
| Supabase PostgreSQL | Primary database | Worker: `HYPERDRIVE` binding. RLS tests: `DATABASE_URL` (session pooler, SSL) |
| Cloudflare Pages | Frontend hosting (`watchpapa`) | Build `cd Frontend && npm run build`; publish `Frontend/dist` |
| Cloudflare Workers | API (`watchpapa-api`) | Route `api.watchpapa.tv/*`; Hyperdrive; rate-limit bindings |
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

- **No content in the DB.** Movies/shows/etc. are always fetched live from TMDB via the Worker (`features/content/hooks/*` on the frontend, `tmdbFetch` in the Worker). The 15 mirror tables are empty and unused.
- **Content is keyed by `tmdb_id`.** User rows (`user_rating`, `watchlist_item`, `profile_favourite`, `user_followed_*`) store `(media_type, tmdb_id)` — no FK to any table. Hydrate cards via `useContentBatch`.
- **Raw SQL only (Worker).** `worker/src/db.js` `withSql(c, sql => …)` with `postgres.js` tagged templates + `sql.begin()` for transactions. int8 is parsed as a JS number.
- **PK types.** `profile.id` is UUID = `auth.users.id`. Other user tables use `bigint` identity PKs.
- **Frontend data split.** `supabase` client for user tables (RLS-gated). `apiFetch()` (`lib/api.js`) → Worker for content, search, import, rewards, referral, announcements, admin.
- **Admin fetches.** `adminFetch()` at `Frontend/src/features/admin/adminFetch.js` — auto-attaches the Bearer token.
- **Free-plan awareness (Worker).** 50 subrequests + 10 ms CPU per request. Cache API calls share that budget → use `fetch(url, { cf: { cacheEverything, cacheTtl } })`, not `caches.default`. Fan-out endpoints cap by a wrangler `var`.
- **Migrations are one-way.** Never modify an applied migration file. Create a new numbered file.
- **Content locale travels as query params, never headers/JWT.** `/api/content*` and `/api/search*` are anonymous, edge-cached routes — a locale read from a JWT/DB would poison a shared cache or force it private. `lang`/`region`/`native` (see API Route Map) are the only channel; `worker/src/tmdb/client.js` `buildUrl` relies on their fixed position in the query string to keep the edge cache key stable.
- **Adult filtering = `adult || nsfw`, not just `adult`.** TMDB's `adult` flag misses keyword-only softcore/erotica content; every gate (`useMovieData`, `useShowData`, `usePersonData`, `useActivityFeed`, and the Worker's `/discover`, `/list`, `/search`) checks `nsfw` alongside `adult`. Tune the keyword/regex/allowlist in the one file, `worker/src/tmdb/nsfw.js`.
- **Watch-provider data requires JustWatch attribution.** Any UI showing TMDB watch-provider data (Settings, `WhereToWatch`) must credit JustWatch per TMDB's terms — see `lib/constants.js` `JUSTWATCH_ATTRIBUTION_URL`.
- **New follows are blocked once a movie is released or a show has ended** (`lib/followGate.js` `movieFollowBlock`/`showFollowBlock`) — client-side only, since the DB can't know TMDB release dates. Existing follows are never affected: nothing in the calendar/follows read path filters by release/end state, so an already-followed released title keeps showing everywhere.

---

## Recent Fixes & Features

**2026-09 user avatars:**

- New `profile.avatar_type` (`default`\|`poster`\|`upload`, migration 033). Default is the plain username-initial circle the app always used; any tier can pick a TMDB **movie** poster as their avatar (`components/ui/MediaSearchModal.jsx`, extracted from `FavouritesEditor.jsx` so both share it — `FavouritesEditor` still allows shows too); Pro/Pro+/God can upload and crop a custom photo (`react-easy-crop`, `components/profile/AvatarPicker.jsx`, `lib/cropImage.js`) to the new public `avatars` Storage bucket. Tier is enforced server-side by both a `guard_profile_avatar_tier` trigger and the bucket's own RLS — the client-side lock is UI-only. (A generated-identicon default was tried and replaced with plain initials — not liked.)
- New shared `components/ui/Avatar.jsx` replaces the old "first letter in a circle" initials rendering in `ProfileMenu`, `ProfilePage`, and `UserResultRow` (search/observer lists — `search_profiles`/`get_observers`/`get_observing` RPCs extended with the avatar columns). Not wired into the activity feed or "who rated this" panel, which show no identity avatar for anyone today and are backed by RPCs that would need their own migration — left as a follow-up.
- New `lib/tier.js` `isProTier()`/`isPremiumTier()` shared helper, introduced for the upload tier-gate; four pre-existing duplicate tier-check spots elsewhere were left alone (out of scope for this change).

**2026-09 content locale, watch providers, NSFW filtering, filmography controls, follow gating:**

- **Content language + title mode + region** — new `profile` columns (migration 032) and `features/preferences/PreferencesContext.jsx`. Worker: `tmdb/locale.js` `readLocale()`, `client.js` threads `language` through `buildUrl` (position kept stable for the edge cache key), `normalize.js` `pickTitle()`/`pickRegionalRelease()`. New `GET /api/content/config/locales`. Frontend `lib/api.js` appends `lang`/`region`/`native` to every content/search request; `useContent`/`useContentBatch` caches are locale-keyed.
- **Watch providers ("Where to watch")** — movie/show detail + batch append `watch/providers`; `normalize.js` `compactWatchProviders()`. New `GET /api/content/watch/regions` + `GET /api/content/watch/providers`. New `components/detail/WhereToWatch.jsx` panel on `MoviePage`/`ShowPage`; new "Available on your services" row on `/movies`/`/shows` (`useMediaBrowse.js`) and "Popular on my streamings" on `/` (`useHomeData.js`), both via `/discover/:type?with_watch_providers=`. Settings gained region-chip + provider-grid pickers — **picking specific providers is Pro/Pro+/God only** (migration 034 `guard_profile_watch_providers_tier`; watch regions stay open to all tiers). JustWatch attribution throughout per TMDB's terms. No subtitle/audio-language availability data exists in TMDB's free API — not implementable.
- **NSFW filtering beyond `adult`** — new `worker/src/tmdb/nsfw.js` (curated keyword-id blocklist + narrow title regex + per-id allowlist). Popular/top-rated list kinds now route through `/discover/*` (`tmdb/discover.js`) instead of TMDB's `/movie/popular` etc., since those ignore `include_adult` and have no keyword filter. `nsfw` flag added alongside `adult` on every card/detail/search-result/person-credit payload; every frontend adult gate checks `adult || nsfw`.
- **Person filmography sort/filter** — `usePersonData.js` merges duplicate role/job rows per title (`features/person/lib/filmography.js` `mergeCredits`) and carries `date`/`popularity`/`voteAverage`/`voteCount`/`episodeCount` (previously dropped). `PersonPage.jsx` defaults to newest-first, adds Movies/Shows + department filters and a Newest/Oldest/Most popular/Highest rated/Title sort.
- **Follow gating** — `lib/followGate.js`: a movie already released (`status`/regional-effective date) or a show that's ended/canceled can no longer be newly followed (`FollowButton` `blockedLabel`, `MediaCard` `followBlockedLabel`, guards in `useMovieData`/`useShowData`/`useShowFollow`). Existing follows are unaffected — nothing in the calendar/follows read path filters by release/end state. `FollowsPage` gained lifecycle chips; the unused `ManageFollowsModal.jsx` (source of the lifted chip logic) was deleted.

**2026-06 rating & navigation system improvements:**

- **Half-heart display fix** (`HeartDisplay.jsx`): Replaced `Math.random()` UID generation with `useId()` hook to ensure stable clipPath IDs across React 18 concurrent renders. Removed dead `Heart` component from `RatingSidebar.jsx`.
  
- **Unreleased content gating** (`RatingSidebar.jsx`, 4 detail pages): Added `isUnreleased` prop. When true (checked via date comparison: `new Date(release_date) > new Date()`), shows "Not yet released" and disables rating interaction. Applied to `MoviePage`, `ShowPage`, `SeasonPage`, `EpisodePage` using their respective date fields (`release_date`, `first_air_date`, `air_date`).

- **TMDB rating fallback** (`RatingHistogram.jsx`): When community vote count < 10, if `tmdbVoteAvg` is provided, shows TMDB's average rating (formatted to 1 decimal place) instead of "Not enough ratings yet". Applied to `MoviePage` and `ShowPage` via `tmdb_vote_avg` column. Seasons & episodes omit this prop (no TMDB column available).

- **Episode navigation** (`EpisodePage.jsx`): Added prev/next episode buttons using `season.episode` array. Finds current episode by ID, sorts by `episode_number`, renders navigation links when siblings exist. Styled as two-column hover-lift cards with arrows.

- **Season navigation** (`SeasonPage.jsx`, `useSeasonData.js`): Extended `useSeasonData` hook to fetch sibling seasons via `season(id, name, season_number)` relation in the show select query. Exposes `seasons` state; `SeasonPage` computes prev/next and renders dual navigation cards matching episode style.

- **Media share captions** (`MediaShareModal.jsx`, `generateMediaShareCard.js`): Added optional caption field (max 100 chars) in the media share modal. Users can add a short thought above the poster in the generated card. Caption text wraps across multiple lines if longer. Debounced preview generation (300ms) to prevent flickering while typing. Canvas draws quoted caption centered above poster in `#a0a0cc` color at 28px font, with ellipsis fallback on extreme overflow.

- **Adult content.** `showAdult` boolean is derived from `profile.setting_display_adult_content` and passed as a prop — not stored in React context. Include it in any query that filters `adult` content.
