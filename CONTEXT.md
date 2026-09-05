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
│   │   ├── audit.js                 # auditLog(action, fields=[]) middleware (no fields ⇒ records no body) + setAudit(c, {targetUserId, extra}) → executionCtx.waitUntil INSERT
│   │   ├── auditActions.js          # ACTION_GROUPS / AUDIT_ACTIONS / ACTION_SET / SOURCES — the one registry of audit_events.action values, served at GET /api/admin/audit-log/actions
│   │   ├── ratelimit.js             # RL_GLOBAL / RL_MUTATION wrappers (no-op if binding absent)
│   │   ├── tmdb/
│   │   │   ├── client.js            # tmdbFetch(env, path, params, {ttl, language}) — fetch + cf cache + 429 retry
│   │   │   ├── normalize.js         # TMDB payloads → the field names the UI reads (id === tmdb_id); native-title swap, regional release date, watch-provider compaction, NSFW flag
│   │   │   ├── lists.js             # list-kind → TMDB endpoint (or a /discover spec) + TTL map
│   │   │   ├── locale.js            # readLocale(c) — parses/validates lang/region/native/include_adult/providers query params
│   │   │   ├── nsfw.js              # NSFW_KEYWORD_IDS / NSFW_TITLE_RE / NSFW_ALLOW_IDS / isNsfw() / filterNsfw() — single tunable module for adult-flag-evading content
│   │   │   └── discover.js          # discoverParams() + runDiscover() — shared /discover/{movie,tv} builder (popular/top-rated list kinds, coming-soon, "available on your services", /discover/:type incl. the /adult page's adult_only/keyword/sort); backfillShowStatus() — see "Show status backfill" below
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
│   │   │   ├── hooks/useContent.js   # useMovie/useShow/useSeason/useEpisode/usePerson/useCollection/useCertifications/useContentList/useDiscover/useGenres — cache keyed by `${localeKey}|${path}`
│   │   │   ├── hooks/useContentBatch.js  # POST /api/content/batch — hydrate cards for user-data rows; cache keyed by `${localeKey}:${cardKey}`
│   │   │   ├── hooks/useMediaBrowse.js   # shared engine for /movies + /shows (popular + coming-soon + genre rows + "Available on your services" row)
│   │   │   └── lib/keys.js           # cardKey(item), itemFromRow(row) — map a (media_type, tmdb_id) row to a batch item
│   │   ├── preferences/              # ── content-locale + streaming preferences ──
│   │   │   ├── PreferencesContext.jsx    # PreferencesProvider (wraps the route tree in App.jsx) / usePreferences() — showAdult, language, titleMode, region, watchRegions, watchProviders; update() writes profile + refreshes live
│   │   │   └── hooks/useWatchProviderCatalog.js  # useLocaleCatalog / useWatchRegionCatalog / useWatchProviderList / languageLabel()
│   │   ├── person/lib/filmography.js # mergeCredits/sortCredits/filterCredits/departmentsOf — PersonPage filmography sort+filter
│   │   └── admin/hooks/              # useAdminAnnouncements, useIsAdmin, … (via adminFetch.js Bearer helper)
│   ├── features/watchlist/hooks/     # useWatchlistItems (selects tmdb_id, hydrates via useContentBatch; markWatched), useItemWatchlistStatus, useWatchLog(mediaType,entityId,session) — rewatch diary for MoviePage/ShowPage (see lib/watchLog.js, lib/watchTarget.js)
│   ├── features/rating/hooks/        # useRating(mediaType, tmdbId, session, {tmdbShowId,seasonNumber,episodeNumber}), useCommunityRatings(mediaType, tmdbId)
│   ├── features/profile/hooks/       # useProfileData(username, session), useProfileRatings(profileId), useProfileStats(profileId, ownerTier), useEditProfile(session), useProfileRecapStats(profileId, tier) — fetches last 30 days of user_rating and aggregates into weekly/monthly windows client-side
│   ├── features/follows/hooks/       # useFollows(session), useOverageStatus(session, refreshKey) — NOTE: ReleasesCalendarPage and FollowsPage derive overage live from reactive arrays instead of calling this hook
│   ├── features/home/hooks/          # useHomeData(session, showAdult) — Popular/Suggested/"Popular · On Your Services"/"Suggested · On Your Services"/Coming Soon/Movies/Shows; row set + order + visibility driven by lib/homeRows.js + prefs.homeRowOrder/homeHiddenRows. useSuggestionSeeds(session) — gathers ratings+watched titles as recommendation seeds. Both Suggested rows paginate (`hasMoreSuggested*`/`loadMoreSuggested*`) by incrementing `page` on `/api/content/recommendations` while folding every shown id into `exclude`
│   ├── features/collection/hooks/    # useCollectionData(id, session) — GET /api/content/collection/:id + follow state for its `parts`; backs CollectionPage
│   ├── features/myServices/hooks/    # useMyServicesPageData(session, showAdult, tier) — merged movie+show Popular/Top Rated (sort=rated)/Suggested (resultsOnMyServices, paginated) rows + one discover-with-provider-filter row per movie genre and per show genre; backs MyServicesPage (Pro+ + provider/region picked, else gated)
│   ├── components/
│   │   ├── watchlist/                # AddToWatchlistButton — auto-adds to first list (upserts, since a watched title's row may need reactivating), toast + checklist picker (multi-list); compact prop for WatchlistsPage; WatchedPanel (rewatch diary — see below)
│   │   ├── rating/                   # HeartDisplay, RatingInput, RatingButton, RatingSidebar (always-visible sidebar widget), RatingHistogram (bar tooltips on hover), RatingHistoryPanel (only renders once a rating has changed at least once — see useRatingHistory.js)
│   │   ├── profile/
│   │   │   ├── generateShareCard.js  # Canvas 2D renderer for 4K share cards (story 9:16, square 1:1, wide 16:9); tier-gated layouts + personality emoji; scale param for preview (1x) vs download (3x). Exports generateRecapShareCard(format, recapData, profileData, scale) for weekly/monthly recap cards
│   │   │   ├── ProfileShareModal.jsx # Format picker (3 pills), cardType selector (Profile/Weekly/Monthly), WYSIWYG preview (canvas at 1x scale), Download PNG + Share (Web Share API mobile, fallback download on desktop). Recap tabs only show if recapStats has data
│   │   │   └── AvatarPicker.jsx      # Avatar section on /profile/edit — initials (default, any tier) / TMDB movie or show poster (any tier, via MediaSearchModal) / cropped photo upload (Pro+ only, react-easy-crop) — see useEditProfile.js
│   │   │   # Also: ProfileFavourites, FavouritesEditor, ProfileStats (tier-gated blur), ProfileRatingCard
│   │   ├── detail/
│   │   │   ├── generateMediaShareCard.js # Canvas generator for movie/show share cards (3 formats: story 9:16, square 1:1, wide 16:9; 3 detail levels: minimal/standard/rich). Loads poster via TMDB + logo, renders hearts if user rated
│   │   │   └── MediaShareModal.jsx # Format + detail level selectors (pill buttons), live preview, Download (4K) + Share buttons. Internally calls useRating to fetch user's rating for the media
│   │   ├── layout/                   # navigation.js (the IA: BROWSE/MORE/LIBRARY/SOCIAL/ACCOUNT link lists + useNavModel), Navbar (logo · text nav md+ with "More ▾" popover · search field lg+ / icon panel below · Radar · bell · account), AccountMenu (AccountMenuContent + AccountMenuButton: click-to-open avatar → Popover md+ / Sheet <md), MobileDrawer (left Sheet, every destination grouped), BottomTabBar (<md: Home · Browse · Search · Radar · You), NotificationBell (Popover, unread from CurrentUserContext), Footer, Breadcrumbs, PosterBackground
│   │   ├── ui/                       # Button, Input, Toggle, Select, Avatar, MediaSearchModal (movie/show search picker, shared by FavouritesEditor [both] + AvatarPicker [movies only]), OtpInput, PageHead, RichTextEditor, OverLimitBanner, …
│   │   ├── detail/                   # DetailPageLayout (hero + single-mount activity aside; see "Detail pages" below), DetailHero, MediaActionPanel, PosterCard (download button in the corner — fetches via tmdbImgProxied/`/api/image-proxy` at `original` size, since the raw TMDB CDN URL isn't fetchable cross-origin; shared by Movie/Show/Season/CollectionPage), CastGrid, FollowButton (blockedLabel prop), WhereToWatch (streaming-provider panel), AdminResyncButton (admin-only, role 4; shown on Movie/Show/Person pages), …
│   │   ├── home/                     # MediaCard, MediaGrid, MediaRow, SearchBar (autoFocus prop for the Navbar dropdown; also used inline on AppHomePage/MoviesPage/ShowsPage)
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
│       ├── homeRows.js               # HOME_ROW_LABELS + DEFAULT_HOME_ROW_ORDER + effectiveHomeRowOrder() — home page row registry, shared by AppHomePage.jsx and SettingsPage.jsx
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
| `GET` | `/api/content/movie/:id` · `/show/:id` · `/show/:id/season/:n` · `/show/:id/season/:n/episode/:m` · `/person/:id` | `:id` = TMDB id. `append_to_response` credits/aggregate_credits/combined_credits + `release_dates,keywords,watch/providers` (movie/show), plus `content_ratings` (show only). One extra en-US fetch fills `overview`/`tagline` when the requested language has no translation (TMDB returns those empty, not falling back). Movie/show detail also carry `certification`/`certification_region` (from `release_dates`/`content_ratings`, region-matched) and, for movies, `collection` (`belongs_to_collection` passthrough) |
| `GET` | `/api/content/collection/:id` | `:id` = TMDB collection id → `{type:"collection", id, name, overview, poster_path, backdrop_path, parts:[...movie cards]}`. Missing `overview` in the requested language is backfilled from `/collection/:id/translations` (falls back to en-US) instead of a second `/collection/:id` fetch |
| `GET` | `/api/content/certifications` | `{movie:{US:[{certification,meaning,order}],…}, tv:{…}}` — TMDB `/certification/{movie,tv}/list`, static reference data cached at `TTL.certifications` (7d); used to label the per-title `certification` above |
| `GET` | `/api/content/search/collections?q=&page=` | TMDB has no "browse all collections" endpoint, only `/search/collection` — this wraps that; `/collections` is a search-only page for this reason |
| `GET` | `/api/content/list/:kind?page&include_adult` | kind ∈ movies-popular / shows-popular / movies-top-rated / … (see `tmdb/lists.js`). Popular/top-rated kinds are **served via `/discover/*`** (not the raw TMDB list endpoint) so `include_adult`, NSFW-keyword exclusion, language and region all apply — TMDB's list endpoints ignore `include_adult` entirely |
| `GET` | `/api/content/discover/:type?with_genres&upcoming&page&with_watch_providers&watch_region&with_watch_monetization_types&adult_only&keyword&sort` | `:type` = movie \| tv — powers genre rows, "coming soon", and the "Available on your services" row. `adult_only=1` flips the NSFW keyword filter to *inclusion* (the hidden `/adult` page); `keyword=` narrows to one NSFW category (pipe-joined ids, validated against `nsfw.js`); `sort=` popular \| rated (adds `vote_count.gte=20`) \| newest — empty by construction unless `include_adult=true` |
| `GET` | `/api/content/adult/categories` | static `{categories:[{key,label,ids}]}` from `nsfw.js` `NSFW_CATEGORIES` — the `/adult` page's category filter; `ids` goes straight back as `keyword=` |
| `GET` | `/api/content/genres` | `{movie:[], tv:[]}` |
| `GET` | `/api/content/watch/regions?lang=` | `{regions:[{code,name,nativeName}]}` — TMDB `/watch/providers/regions` |
| `GET` | `/api/content/watch/providers?type=movie\|tv\|all&region=` | `{region, providers:[{id,name,logo_path,priority}]}` — TMDB `/watch/providers/{movie,tv}`, merged + priority-sorted for `type=all` |
| `GET` | `/api/content/config/locales?lang=` | `{languages:["en-US",…], countries:[{code,name,nativeName}]}` — TMDB `/configuration/primary_translations` + `/configuration/countries`; backs the Settings language/country pickers |
| `POST` | `/api/content/batch` | `{items:[…]}` → `{cards, missing}` — card hydration; movie items append `release_dates,keywords`, show items append `keywords` |
| `POST` | `/api/content/releases` | `{showIds, year, month}` → episode air dates |
| `POST` | `/api/content/recommendations` | `{items:[{type,id}], exclude:[{type,id}], page?, providers?, watchRegion?}` → `{results, resultsOnMyServices?}` — "Suggested for you" rows; **never edge-cached** (per-user), `Cache-Control: private`. `page` (default 1) re-fetches each seed's TMDB `/recommendations` at that TMDB page instead of page 1 — infinite scroll is the client incrementing `page` while folding every id it's already shown into `exclude` (the endpoint is stateless, so that client-side exclude growth is what keeps later pages from repeating earlier ones) |
| `GET` | `/api/search?q=&page=&include_adult=` (also accepts `includeAdult=`) | backed by TMDB's `/search/multi` — one relevance-ranked, type-mixed call (movies/shows/people) instead of three merged typed searches → `{results:[{type,tmdbId,title,originalTitle,posterPath,year,date,popularity,voteAverage,adult,nsfw}], page, total_pages}`; order is TMDB's own relevance ranking, preserved as-is (no re-sort, no per-type cap) |
| `GET` | `/api/posters` | 80 popular poster paths (auth-page wall) |
| `GET` | `/api/image-proxy?path=&size=` | streamed, CORS, edge-cached — for canvas/share cards |
| `GET` | `/sitemap.xml` · `/sitemap-{static,movies,shows,people}.xml` | from TMDB lists, 24h cache |
| `GET` | `/health` | `{status:"ok"}` |

**User data** (`routes/referral.js`, `rewards.js`, `announcements.js`, `import.js`, `admin/*`):

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/referral/use/:code` | JWT + mutation limit + audit | |
| `POST` | `/api/rewards/claim` | JWT + mutation limit + audit | `sql.begin()` transaction |
| `GET`/`POST`/`PATCH` | `/api/announcements[/…]` | public GET; JWT + requireEditor writes | SQL on `announcements`; POST/PATCH/archive audited |
| `POST` | `/api/import/resolve` | JWT + audit | `{items:[{name,year,uri?}]}` ≤ IMPORT_CHUNK_MAX → `{resolved:[{tmdbId,…}], unresolved}`. No DB writes |
| `POST` | `/api/import/commit` | JWT + audit | insert `user_rating` / `watchlist_item` by `tmdb_id`, both inside one transaction with `SET LOCAL watchpapa.audit_skip='1'` (so the DB row triggers stay quiet and this route's own `import_committed` summary row is the only audit entry); `WATCHLIST_LIMIT_REACHED → 422` |
| `GET` | `/api/import/export` | JWT | **JSON** `{ratings, watchlistItems}` keyed by tmdb_id — frontend composes the CSV |
| `*` | `/api/admin/{users,stats,reward-codes,referrals,audit-log,announcements}/*` | JWT + requireAdmin (role 4) | |

Dropped vs the old Express API: `/api/inject`, `/api/resolve`, `/api/import/run`, `/api/import/sync-status`, `/api/admin/resync`, `/api/admin/script-logs`, `/api/admin/stats/queue`.

**Admin routes** (all: adminLimiter + requireAuth + requireAdmin, role = 4):

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/users/search?email=` | Search users |
| `GET` | `/api/admin/users/staff` | Role 3 + 4 accounts |
| `PATCH` | `/api/admin/users/:id/role` | Set user role (0, 3, or 4) — audited (`admin_role_set`, `target_user_id` set) |
| `POST` | `/api/admin/users/:id/grant-tier` | Upgrade tier via `apply_tier_upgrade` (upgrade-only, no downgrade) — audited (`admin_tier_granted`) |
| `PATCH` | `/api/admin/users/:id/tier` | Direct tier set — any tier incl. `free` and `god`; bypasses rank guards; `free` deletes the subscription row — audited (`admin_tier_set`) |
| `*` | `/api/admin/reward-codes` | Reward code CRUD — every write audited (`reward_code_generated/created/toggled/updated/deleted/bulk`) |
| `GET` | `/api/admin/stats` | Platform statistics |
| `GET` | `/api/admin/referrals` | Referral leaderboard |
| `GET` | `/api/admin/audit-log[/actions\|/auth]` | App-event log with `action`/`email`/`user_id`/`target_user_id`/`path`/`source`/date filters (`/actions` serves the registry that drives them); `/auth` is a read-only tab over Supabase's own `auth.audit_log_entries` (sign-in/out, OAuth, recovery, token refresh, deletion) |
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
| `/collections` | Public | `CollectionsPage` | Search-only collection browser (TMDB has no "list all collections" endpoint) — a search box + result grid of `CollectionCard`s linking into `/collections/:id` |
| `/collections/:id` | Public | `CollectionPage` | TMDB collection hub — banner + overview + a `MediaGrid` of `parts` (movies only, TMDB has no show collections); linked from `MoviePage` when `movie.collection` is set |
| `/my-services` | Public | `MyServicesPage` | Full browse page for "your services" (Pro+ + at least one provider/region picked in Settings, else an upgrade/setup prompt): Popular, Suggested For You, Top Rated (all provider-filtered, paginated), plus one "Popular on `<service>`" row per provider the user picked |
| `/people` | Public | `PeoplePage` | |
| `/people/:id` | Public | `PersonPage` | |
| `/calendar` | Public | `ReleasesCalendarPage` | Today's releases highlighted amber; multiple episodes from same season collapse to "Season X"; hovered day scales 6% with purple border; calendar blocked (overage gate) when follow count exceeds tier limit — computed live from reactive arrays |
| `/updates` | Public | `UpdatesPage` | Announcements feed |
| `/subscription` | Public | `SubscriptionPage` | |
| `/about`, `/help`, `/terms`, `/contact`, `/privacy`, `/certifications` | Public | `StaticInfoPages` | Footer pages, rewritten 2026-09-05 to match the current feature set (see Recent Fixes). Internal links use `<Link>`; `LAST_UPDATED` const at the top of the file is the Terms/Privacy "last updated" date — bump it whenever either changes.  `/certifications` (`CertificationsInfoPage`) explains movie/show certifications with a per-country lookup table off `/api/content/certifications`; linked from the badge on `MoviePage`/`ShowPage` and the footer |
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
| `profile` | `uuid` (= `auth.users.id`) | `username` (unique, nullable), `role`, `bio`, `date_of_birth` (nullable), `setting_display_adult_content`, `referral_code`, `email_marketing_opt_in`, `setting_language` (default `en-US`), `setting_title_mode` (`translated`\|`native_original`), `setting_region` (nullable ISO 3166-1), `setting_watch_regions` (`TEXT[]`, ≤5), `setting_watch_providers` (`INTEGER[]`, ≤50), `avatar_type` (`default`\|`poster`\|`upload`), `avatar_poster_media_type`/`avatar_poster_tmdb_id`/`avatar_poster_path`, `avatar_upload_path`, `setting_home_row_order`/`setting_home_hidden_rows` (`TEXT[]`, ≤20 each) | role: 0=user, 3=editor, 4=admin |
| `user_rating` | `bigint` identity | `profile_id`, `media_type` ('movie'\|'show'\|'season'\|'episode'), `tmdb_id`, `tmdb_show_id`+`season_number`(+`episode_number`) for season/episode, `value` (1–10) | UNIQUE `(profile_id, media_type, tmdb_id)`. RLS read via `can_view_ratings()`. Insert/update fires `log_user_rating_change()` → `user_rating_history` (migration 039). |
| `user_rating_history` | `bigint` identity | `profile_id`, `media_type`, `tmdb_id`, `value`, `changed_at` | Own-read-only; written only by the trigger above, not by clients. One row per initial rating + every later value change (not per clear). See `RatingHistoryPanel.jsx`. |
| `watch_log` | `bigint` identity | `profile_id`, `media_type` ('movie'\|'show'), `tmdb_id`, `watched_at` (date), `created_at` | Own-rows RLS. One row per (re)watch — no uniqueness constraint. Source of truth for "watched"; see `WatchedPanel.jsx` / `useWatchLog.js`. |
| `profile_favourite` | `bigint` identity | `profile_id`, `position` (1–5), `media_type`, `tmdb_id` | UNIQUE `(profile_id, position)` |
| `user_followed_movies` | `bigint` identity | `profile_id`, `tmdb_id` | UNIQUE `(profile_id, tmdb_id)` |
| `user_followed_shows` | `bigint` identity | `profile_id`, `tmdb_id` | UNIQUE `(profile_id, tmdb_id)` |
| `user_subscriptions` | `uuid` | `profile_id`, `tier`, `is_early_adopter`, `expires_at`, `ea_banner_dismissed` | Use `get_effective_tier()` RPC — never raw `tier` |
| `reward_codes` | `uuid` | `code`, `tier`, `duration_days`, `max_uses`, `is_active` | |
| `reward_code_claims` | `uuid` | `code_id`, `profile_id` | Prevents duplicate claims |
| `referrals` | `uuid` | `referrer_id`, `referred_id` (unique) | |
| `audit_events` | `uuid` | `action`, `user_id`, `target_user_id`, `email`, `ip`, `method`, `path`, `body`, `status`, `source` (`worker`\|`db`\|`auth`), `created_at` | Written by the Worker's `auditLog` middleware (`source='worker'`) or a DB trigger via `audit_write()` (`source='db'`, migration 044); `auth` events live separately in Supabase's own `auth.audit_log_entries`, read-only. RLS: no client SELECT/INSERT — admin-only via the Worker. 90-day retention (migration 023). |
| `announcements` | `uuid` | `title`, `body`, `archived`, `author_id`, `archived_by`, `archived_at` | |
| `watchlist` | `bigint` identity | `profile_id`, `name`, `created_at`, `updated_at` | Per-tier limit enforced by `enforce_watchlist_limit` trigger |
| `watchlist_item` | `bigint` identity | `watchlist_id` FK, `media_type` ('movie'\|'show'), `tmdb_id`, `watched` (legacy, unused by new code), `added_at` | UNIQUE `(watchlist_id, media_type, tmdb_id)`. Purely "is this on my to-watch list" now — rating or logging a watch (`watch_log`, above) deletes the row outright rather than flipping `watched`. That column only still matters as a defensive read-side filter for any pre-migration-038 row that has it set. See "Rewatch diary" below. |

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
| 035 | `home_row_preferences` | Adds `setting_home_row_order`/`setting_home_hidden_rows` (`TEXT[]`, ≤20 each) to `profile` — which home-page rows show and in what order. Empty order = app default (`Frontend/src/lib/homeRows.js` `DEFAULT_HOME_ROW_ORDER`); no tier gate, free for every user. |
| 036 | `blur_nsfw_posters` | Adds `setting_blur_nsfw_posters` (`BOOLEAN`, default `true`) to `profile` — blur nsfw-flagged posters wherever they appear as cards. Only meaningful with `setting_display_adult_content` on. |
| 037 | `show_adult_tab` | Adds `setting_show_adult_tab` (`BOOLEAN`, default `false`) to `profile` — separate opt-in for the hidden "Adult" header tab + `/adult` page, on top of the general adult-content switch. Never effective unless `setting_display_adult_content` is also true. |
| 038 | `watch_log` | **Applied 2026-09-05.** New `watch_log` table (`profile_id`, `media_type` movie\|show, `tmdb_id`, `watched_at` date, `created_at`) — one row per (re)watch, replacing `watchlist_item.watched` as the source of truth for "is this watched". Own-rows RLS (`profile_id = auth.uid()`), no uniqueness constraint (rewatches are multiple rows). See "Rewatch diary" below. |
| 039 | `rating_history` | **Applied 2026-09-05.** New `user_rating_history` table (`profile_id`, `media_type`, `tmdb_id`, `value`, `changed_at`) + `log_user_rating_change()` SECURITY DEFINER trigger (`AFTER INSERT OR UPDATE ON user_rating`, same convention as `audit_user_follow_change` from migration 002) that logs the initial rating and every later value change. Keyed on `(profile_id, media_type, tmdb_id)`, not a FK to `user_rating.id`, so history survives clear-then-re-rate (which deletes and later re-inserts a new row with a new id). Clearing a rating is not itself logged. Own-read-only RLS — clients have no INSERT/UPDATE/DELETE policy; only the trigger writes. |
| 040 | `backfill_watch_history` | **Applied 2026-09-05, one-time data backfill (idempotent, re-runnable).** Both 038 and 039 shipped after ratings already existed, so every pre-existing rating had zero rows in each — `INSERT … SELECT … WHERE NOT EXISTS` populates one `watch_log` row per existing movie/show rating (dated to that rating's own `created_at`, not "today") and one `user_rating_history` baseline row per existing rating of any media type (so a first post-migration change correctly produces 2 history rows, not 1). Season/episode ratings are skipped for the `watch_log` half — there's no single retroactive "the show is watched" moment to assign without knowing whether every season/episode was ever rated. 803 watch_log + 837 history rows backfilled. |
| 041 | `rating_history_own_delete` | Adds a `FOR DELETE ... USING (profile_id = auth.uid())` policy to `user_rating_history` (migration 039 only granted clients SELECT — writes were trigger-only). Lets `RatingHistoryPanel.jsx` remove individual history entries; purely edits the historical record, the live `user_rating.value` is untouched. |

| 043 | `profile_banner` | **Applied 2026-09-05.** Adds `banner_favourite_position` (SMALLINT 1–5, NULL = first favourite) and `banner_crop` (JSONB `{x,y,width,height}` in percent of the source image, NULL = centred) to `profile` — which favourite's artwork backs the profile banner and how it's cropped. Additive; covered by the existing `profile_update_own` policy. |
| 044 | `audit_coverage` | **Applied 2026-09-05.** Widens `audit_events` with `status`/`target_user_id`/`source` (`worker`\|`db`\|`auth`) + 3 indexes. Adds one generic `SECURITY DEFINER` row trigger `audit_row_change()` attached to `user_rating`, `user_rating_history`, `watch_log`, `watchlist`, `watchlist_item`, `profile_favourite`, `user_observe`, `user_block`, `user_banner_dismissals` — one row per insert/update/delete with a real semantic action name (`rating_set`, `watchlist_item_added`, `observe_accepted`, …). Adds `audit_profile_change()` (`AFTER UPDATE ON profile`) emitting one row **per changed group**, never the whole row (username/dob/role/avatar/bio/banner/marketing/privacy/share/adult-content/adult-tab/nsfw-blur/locale/watch-settings/home-rows), plus `account_deleted` on soft-deletion (`delete_account()` sets `deleted_at`; the row is never hard-deleted, so 024's `AFTER DELETE` cleanup never fires in practice). Statement-level `audit_notifications_cleared()` logs one summary row per bulk notification clear instead of one per row. `audit_skip()`/`audit_write()` helpers; `SET LOCAL watchpapa.audit_skip = '1'` lets a caller suppress the row triggers for a bulk write (the Worker's import-commit route uses this and logs its own one-line summary via `auditLog()` instead). Pins `search_path` on 024's `clean_audit_events_on_profile_delete`. All new functions are `SECURITY DEFINER` with `EXECUTE` revoked from `anon`/`authenticated`. Companion Worker changes: `auditLog()` middleware now defaults to recording **no** body fields (an explicit allowlist is required) and also records `status`/`source='worker'`/`target_user_id`; applied to all 16 previously-unaudited routes (every admin route, `announcements.js`, `import.js`). New `auditActions.js` registry (~65 actions) backs `GET /api/admin/audit-log/actions`, the `/admin/audit-log` filters (400 on an unknown `action`/`source`), and a new read-only `GET /api/admin/audit-log/auth` tab over `auth.audit_log_entries` (Supabase's own sign-in/out/OAuth/recovery/deletion log). |
| 045 | `fix_audit_notifications_cleared` | **Applied 2026-09-05, hotfix for 044.** `audit_notifications_cleared()` used `min(recipient_id)` as its actor fallback; Postgres has no `min()` aggregate for `uuid`, so every bulk notification-clear raised `function min(uuid) does not exist` and rolled back. Replaced with `(array_agg(recipient_id))[1]`. |

To add the next migration: create `Backend/src/db/migrations/046_<name>.sql`, apply via `mcp__claude_ai_Supabase__apply_migration`.

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

**Auth UI (2026-09 redesign, phase 2)** — `features/auth/components/`:
- Every form renders inside `shared/AuthCard.jsx` (one shell: 440px, `width="md"` = 520px, `noValidate` form when `onSubmit` is passed). Shared pieces: `shared/PasswordField.jsx` (show/hide toggle on every password input, `showPolicy` renders the live checklist), `shared/OAuthButtons.jsx` (Google/GitHub with one shared pending state), `shared/StepIndicator.jsx`, `shared/ProfileDetailsFields.jsx` (username · date of birth · optional referral code · terms + marketing consent · adult-content `Switch` once the DOB says 18+).
- **Register is a 2-step wizard** (`RegisterForm.jsx`): step 1 email + password + repeat (or OAuth) → step 2 `ProfileDetailsFields`. Values persist across steps; `signUp` only fires on the final submit; an "email already in use" error drops back to step 1 with the error on the email field. Then `/verify-email?email=&sent=1` (the `sent` flag starts the 30s resend cooldown and shows the "we sent a code" note).
- `CompleteUsernameForm.jsx` (OAuth users with no username/DOB) is the same step-2 fields (`showReferral={false}`, `showAdultSwitch`) writing `profile.upsert` as before, now with per-field errors.
- `VerifyEmailForm.jsx`: the address is shown in a "Sent to" block with a "Not you?" action that makes it editable (resend goes to the corrected address); the cooldown only counts down after a send. `ForgotPasswordForm.jsx` has two explicit states (request → sent: OTP entry, resend, change email). `ResetPasswordForm.jsx` uses the same password policy as register and shows a proper "Reset link needed" state (link to `/forgot-password`) when there is no recovery session.
- One policy/validator set in `lib/validate.js`: `validateEmail`, `validatePassword` + `getPasswordPolicyStatus` + `PASSWORD_RULES` (≥8, lower, upper, digit, symbol — Reset was "≥8 only" before), `validateUsername`, `validateMinAge`, `isAdult`/`ageFromDate` (replaces the three inline age calculations), `maxDateOfBirth`. Referral/gift-code application is one helper, `features/auth/lib/applyPendingPromoCode.js` (`applyPromoCode`, `stashPendingPromoCode`, `applyPendingPromoCode`) instead of three copies.
- All six auth pages set `<PageHead noindex>`. `AuthLayout` caps the logo at 200–300px; `PosterBackground` uses 3/4/6/8 columns by viewport and pauses under `prefers-reduced-motion`. `components/ui/Input.jsx`/`FormField.jsx` are now generic form primitives (44px+ inputs, `hint`/`required`/`optional`, `aria-invalid` error styling) rather than auth-only styling.

**Worker (per-request), `worker/src/auth.js`:**
- `requireAuth`: verifies the Bearer JWT **locally** against the Supabase JWKS (`jose`, ES256; issuer `${SUPABASE_URL}/auth/v1`, audience `authenticated`). No network round-trip. Sets `c.get('user') = { id: sub, email }`.
- `requireAdmin`: `SELECT role FROM public.profile WHERE id = $1` over Hyperdrive; requires `role = 4` (int8 is parsed as a JS number — see `db.js`).
- `requireEditor`: same, `role IN (3, 4)`.

---

## TMDB Content Architecture

**No mirror.** All movie/show/season/episode/person/credit/genre data is fetched **live from TMDB v3** by the Worker (`worker/src/tmdb/client.js` → `fetch(url, { cf: { cacheEverything, cacheTtl } })`, per-endpoint TTLs 6h–7d) and normalized (`normalize.js`) into the exact field names the UI reads — `id === tmdb_id`, season/episode `still_path` aliased to `poster_path`, `aggregate_credits` roles[]/jobs[] flattened.

- **Detail:** `GET /api/content/{movie,show,season,episode,person}/:id`
- **Browse:** `GET /api/content/{list/:kind,discover/:type,genres}` — `movies-popular`/`movies-top-rated`/`shows-popular`/`shows-top-rated` are **served through `/discover/*`** (`tmdb/discover.js` `discoverParams`/`runDiscover`, shared by `/list/:kind`, `/discover/:type`, and the coming-soon/"available on your services" fetches) rather than TMDB's `/movie/popular` etc., because those list endpoints ignore `include_adult` and have no keyword-exclusion param. Other kinds map straight to a TMDB list path in `lists.js`.
- **Show status backfill.** TMDB's list/discover/recommendations responses never include a show's `status` (or `in_production`/`last_air_date`) — that only exists on the full `/tv/{id}` detail payload. Without it, `lib/followGate.js` `showFollowBlock()` on the frontend can't detect an ended/canceled show, so "Follow" stayed clickable even on something already finished. `tmdb/discover.js` `backfillShowStatus(env, cards, language, maxChecks)` fixes this with one extra `/tv/{id}` lookup per show card missing `status` (edge-cached at `TTL.show` — cheap after the first cold hit for a popular title), capped by the wrangler var `SHOW_STATUS_BACKFILL_MAX` (default 20). Called from `runDiscover()` (covers every discover-backed row) and the non-discover `/list/:kind` branch (`shows-on-the-air`/`shows-airing-today`) and `/api/content/recommendations` (capped to the 24 displayed results, reusing the already-fetched full detail for the provider-filtered list instead of a second lookup).
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
- `components/detail/WhereToWatch.jsx` renders the panel on `MoviePage`/`ShowPage` (region tabs from the user's `setting_watch_regions` — open to every tier). `features/content/hooks/useMediaBrowse.js` (`/movies`/`/shows`) and `features/home/hooks/useHomeData.js` (`/`, row titled "Popular · On Your Services") both add an "Available on your services" row via `/discover/:type?with_watch_providers=&watch_region=&with_watch_monetization_types=flatrate|free|ads`, shown only once the user has picked providers — which, being Pro+ only (below), means the row itself is implicitly Pro+ only with no extra gating needed at the row level. The full `/my-services` page (`MyServicesPage.jsx` + `features/myServices/hooks/useMyServicesPageData.js`) is the dedicated version of that same row set — Popular, Top Rated (`sort=rated`), Suggested For You, and one "Popular on `<service>`" row per provider the user picked (each just that single provider's id in `with_watch_providers`, not personalized — same discover mechanism as Popular, not the recommendations engine) — gated the same way (Pro+ + at least one provider/region picked, else an upgrade/setup prompt). Provider names for those row titles come from `useWatchProviderList(region)` (same catalog hook Settings uses).
- **Choosing specific providers ("My streaming services" in Settings, `setting_watch_providers`) is Pro/Pro+/God only** — watch **regions** stay open to everyone (migration 034 `guard_profile_watch_providers_tier` trigger; `SettingsPage.jsx` shows an upgrade prompt instead of the provider grid below Pro). Browsing a region's full "Where to watch" listing was never gated — only marking *which* providers are yours (highlighting + the "Popular · On Your Services" / "Suggested For You · On Your Services" home rows) is.
- **JustWatch attribution is mandatory** per TMDB's terms — every surface showing provider data (Settings provider grid, `WhereToWatch`) credits JustWatch (`lib/constants.js` `JUSTWATCH_ATTRIBUTION_URL`).
- **No subtitle/audio-language data is available.** TMDB's watch-provider integration (sourced from JustWatch) only returns `{provider_id, provider_name, logo_path, display_priority}` per region/bucket — nothing about which language tracks a given platform offers for a given title in a given region. That data isn't exposed by TMDB's free API at all (JustWatch's own paid Partner API has it, TMDB's integration doesn't). Not implementable without a different, paid data source.

### Recommendations ("Suggested for you")

No collaborative-filtering/ML infrastructure of our own — this leans entirely on TMDB's own per-title `/movie/{id}/recommendations` and `/tv/{id}/recommendations` (TMDB staff recommend these over `/similar`, which is just genre/keyword matching, not behaviour-based).

- `POST /api/content/recommendations` (`worker/src/routes/content.js`): the client sends `items` (seed titles — up to `RECOMMENDATIONS_MAX_SEEDS`, default 8) and `exclude` (titles to never surface). For each seed the Worker fetches TMDB's `/recommendations`, tallies how often each candidate appears across seeds, ranks by `hits` then `popularity`, drops anything in `exclude` or (unless `include_adult`) NSFW, and returns the top 24 as cards. Optional `providers`/`watchRegion` additionally return `resultsOnMyServices`: the same ranked candidates, checked one at a time (bounded by `RECOMMENDATIONS_PROVIDER_CHECK_MAX`, default 15 — kept low enough that seeds + show-status backfill + this always stay under the Free-plan 50-subrequest ceiling in one request) via a `watch/providers`-appended detail fetch, kept only if one of `providers` appears in that region's `flatrate`/`free`/`ads` buckets. That detail fetch (not the list-shaped seed data) is also what backs each card in `resultsOnMyServices`, so it already carries an accurate `status`.
- **Response is per-user and never edge-cached** (`Cache-Control: private`) — but the underlying per-seed TMDB `/recommendations` calls ARE cached the normal way (keyed on id+language via `tmdbFetch`), so an overlapping seed pool across users/requests still hits a warm cache.
- Seeds + exclusions come from the Frontend, which already has this data: `features/home/hooks/useSuggestionSeeds.js` — seeds are the user's own ratings ≥6/10 (best first, ≤10) plus watched-but-unrated watchlist items (≤10); exclude is every rated, watchlisted, or followed movie/show (so nothing already known is "suggested"). Movie/show ratings only feed seeds — season/episode ratings aren't used as seeds (v1 scope), but a show rated only via seasons/episodes (never the show itself) is still added to the exclude list once every real season is covered (all seasons rated, or every episode in each season rated) — checked via a capped (`MAX_COMPLETION_CHECKS`=15) per-show `/api/content/show/:id` lookup against the user's `user_rating` season/episode rows.
- `features/home/hooks/useHomeData.js` calls the endpoint once seeds are ready, passing `providers`/`watchRegion` only when the user has picked streaming services (Pro+, see below) — so `resultsOnMyServices` (and therefore the second row) is naturally Pro+-only with no separate gating. A user with no ratings/watched titles yet gets no seeds, so neither row renders — same "just don't show the empty row" convention as every other home row.
- Row names: **"Suggested For You"** and **"Suggested For You · On Your Services"**, both on `/`; `/my-services` has its own "Suggested For You" row backed by the same endpoint.
- **Infinite scroll:** both rows paginate via `page` (default 1) in the request body — page `n>1` re-fetches each seed's TMDB `/recommendations` at TMDB page `n` instead of page 1. Since the endpoint is stateless/per-user (no server-side "already sent" state), the Frontend (`useHomeData.js`/`useMyServicesPageData.js`) keeps a running set of every id it has already shown and folds it into `exclude` on every call — that's what stops later pages from repeating earlier ones. A page coming back empty means that seed pool is exhausted, so `hasMore` flips false and the row's `MediaRow` stops asking for more.

### Collections

- `GET /api/content/collection/:id` (`worker/src/routes/content.js`) wraps TMDB `/collection/{id}`; `normalize.js` `normalizeCollection()` maps `parts` through the existing `toCard("movie", …)` so a collection's films render as ordinary movie cards. TMDB collections are movie-only (no TV equivalent).
- **`/collections` is search-only** — TMDB has no "list/browse all collections" endpoint, only `/search/collection` (`GET /api/content/search/collections?q=&page=`, `features/collection/hooks/useCollectionSearch.js`, debounced same as the main search box). `CollectionsPage.jsx` shows a prompt until the user types ≥2 characters, then a grid of `components/detail/CollectionCard.jsx` (poster + name only — no follow/watchlist affordances make sense for a collection, so it's a dedicated component rather than reusing the movie/show-specific `MediaCard`).
- Missing `overview` in the requested language is backfilled from `GET /collection/{id}/translations` (matched to the requested language, else en-US) rather than a second `/collection/{id}` fetch in a different language.
- `normalizeMovie()` passes a movie's `belongs_to_collection` straight through as `collection: {id, name, poster_path, backdrop_path}` (or `null`) — free, no extra TMDB call. `MoviePage.jsx` shows a "Part of the X Collection" link when present, to `/collections/:id` (`CollectionPage.jsx` + `features/collection/hooks/useCollectionData.js`).

### Certifications

- `GET /api/content/certifications` (`worker/src/routes/content.js`) wraps TMDB `/certification/{movie,tv}/list` → `{movie:{US:[{certification,meaning,order}],…}, tv:{…}}`, cached at `TTL.certifications` (7d, static reference data).
- Per-title certification comes for free off data already fetched: `normalize.js` `certificationForRegion()` reads it out of a movie's `release_dates` (already appended) or a show's `content_ratings` (newly appended to the show detail route) for the same `region` used for regional release dates, exposed as `certification`/`certification_region` on movie/show detail.
- `MoviePage.jsx`/`ShowPage.jsx` render it as a "Certification:" label + badge next to Genres (same label convention as "Genres:"), `title=` attribute on the badge showing the `meaning` looked up from the catalog above (`lib/certifications.js` `certificationMeaning()`). Scoped to detail pages only — list/discover/batch cards don't carry `release_dates`/`content_ratings` and adding it there would fatten every browse response for a feature that wasn't asked for there.
- The badge is a `<Link to="/certifications">` — a new footer page (`StaticInfoPages.jsx` `CertificationsInfoPage`, same `InfoPageShell` pattern as About/Help/Terms/Privacy/Contact) explains what a certification is and lets you pick a country (defaulting to your `effectiveWatchRegions[0]`, else US) to see that country's full movie + TV certification tables straight from the `/api/content/certifications` catalog.

### NSFW filtering beyond the `adult` flag

TMDB's `adult` flag misses softcore/erotica titles that are only tagged via keywords. `worker/src/tmdb/nsfw.js` is the single tunable module: `NSFW_KEYWORD_IDS` (a deliberately narrow curated set — porn/softcore/hentai/pink-film/sexploitation-style ids only, **not** generic keywords like "nudity" that hit mainstream titles), `NSFW_TITLE_RE` (a title-only regex fallback), and `NSFW_ALLOW_IDS` (per-type id allowlist for known regex false positives). `isNsfw(raw, type)` = `adult || keyword hit || (not allowlisted && title regex hit)`; `filterNsfw(rows, includeAdult, type)` applies it. Wired in: `/discover/*` (`without_keywords` pipe-joined ids sent to TMDB **and** a Worker-side `filterNsfw` post-filter, since TMDB's own list endpoints ignore it), `/list/:kind`, `/api/search` (`normalizeSearchResults`), `/batch` and detail routes (`nsfw` field on cards/movie/show/person-credits). Frontend detail gates and `usePersonData`/`useActivityFeed` treat `adult || nsfw` as restricted, same as the plain `adult` check before.

### User avatars

Three `profile.avatar_type` values, no Worker involvement — all pure Frontend + Supabase Storage (migration 033):

- **`default`** — the username's first letter on a plain circle, same as the app always showed (an earlier generated-identicon pattern was tried and dropped — not liked, reverted to plain initials).
- **`poster`** — any tier can pick a **movie** poster as their avatar via `components/ui/MediaSearchModal.jsx` (`mediaTypes={["movie"]}`; the same component defaults to movies+shows for `FavouritesEditor.jsx`, which still allows both); stores `avatar_poster_media_type`/`avatar_poster_tmdb_id`/`avatar_poster_path`, rendered via the existing `tmdbImg()`.
- **`upload`** — a custom cropped photo, **Pro/Pro+/God only**. `components/profile/AvatarPicker.jsx` opens a `react-easy-crop` crop-and-zoom modal, `lib/cropImage.js` `getCroppedImageBlob()` renders the crop to a 512×512 canvas → JPEG Blob, uploaded to the public `avatars` Supabase Storage bucket at `${uid}/${Date.now()}.jpg` (a fresh filename per upload so the CDN URL always cache-busts). `useEditProfile.js`'s `setAvatarPoster`/`uploadAvatarPhoto`/`setAvatarDefault` all capture the previous `avatar_upload_path` before writing and delete that old storage object afterward whenever it's being replaced or abandoned — so switching to a poster avatar, uploading a new photo, or resetting to default never leaves an orphaned file in the bucket. Tier is enforced **server-side twice**, never trusting the client: the `guard_profile_avatar_tier` trigger on `profile` (rejects the row update) and the `avatars` bucket's `storage.objects` RLS (rejects the upload itself) both call `get_effective_tier()`. A later downgrade does not retroactively clear an existing upload.
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

### UI foundations (2026-09 redesign)

- **Tokens.** `styles/globals.css` declares the palette as Tailwind v4 `@theme` colors
  (`bg`, `surface`/`surface-2/3/4`, `border`/`border-strong`/`border-hover`, `brand`/`brand-deep`/
  `brand-light`, `accent`, `text`/`text-muted`/`text-dim`/`text-faint`/`text-link`/`heading`), so new
  code writes `bg-surface border-border text-text-muted`. Older files keep the identical hex
  literals — no mass rewrite. Also defined there: every keyframe the app references (the old
  `index.css`/`App.css` were never imported and are deleted), `prefers-reduced-motion`,
  `@utility pb-safe/pt-safe/px-safe/pb-tabbar/scrollbar-none`, breakpoints `xs` (400px) and
  `3xl` (1920px), and variants `landscape-short:` (rotated phones, `max-height:500px`) and
  `touch:` (`hover:none`). `index.html` sets `viewport-fit=cover` so safe-area insets are real.
- **Breakpoint convention.** `<md` phone (bottom tab bar + drawer), `md–lg` tablet (text nav),
  `lg+` desktop (detail/admin/settings sidebars), `xl+` wide, `3xl` ultrawide (1920px page cap).
- **Hooks** (`src/hooks/`): `useClickOutside(refs, fn, active)`, `useEscapeKey(fn, active)`,
  `useMediaQuery(q)` + `useIsPhone/useIsDesktop/useIsLandscapeShort/useIsTouch`,
  `useBodyScrollLock(active)` (ref-counted, scrollbar-compensated).
- **Primitives** (`components/ui/`): `Button` (variant primary/secondary/outline/ghost/danger/
  success, size xs–lg, `loading`, `icon`, `to`/`href`), `IconButton` (label required, `badge`),
  `Switch` (44×24, replaces the 176px `Toggle` in dense rows), `Badge`, `PillTabs` (scrollable
  tablist), `Select` (native, `size`/`full`), `PageContainer` (`narrow|reading|standard|wide|full`),
  `PageHeader` (gradient-bar h1 + actions + toolbar slot), `SectionTitle`, `EmptyState`,
  `ErrorNote`, `Skeleton` (+ `SkeletonPoster/Grid/Row/Lines`), `LoadMoreButton`, `Popover`
  (portaled, viewport-clamped, flips), `Sheet` (bottom sheet; side panel on `left`/`right` and
  automatically on rotated phones), `Modal` (full-screen `<sm`), `Menu`/`MenuGroup`/`MenuItem`/
  `MenuDivider` (ARIA menu with arrow-key nav), `DataTable` (table `md+`, stacked cards `<md`).
  `lib/cn.js` now uses `tailwind-merge` so caller classes override primitive defaults.
- **Icons.** `components/icons/index.jsx` — one Feather-style set (`size` prop). New code imports
  from here instead of pasting inline SVGs.

### Detail pages (2026-09 redesign, phase 3)

- `components/detail/DetailPageLayout.jsx` props: `title, subtitle, meta[], backdropPath, poster, actions, panel, children`. `DetailHero.jsx` renders the blurred backdrop + poster (`<lg` only) + title + meta chips ("1999 · 2h 16m · PG-13 · Directed by …") + actions (Follow). Below `lg` the `<aside>` is a full-width block holding the activity panel (poster hidden — it's in the hero); at `lg+` it's a 240px sticky column with poster + panel. **The panel is mounted once** — an earlier version rendered it in both a hidden sidebar and the content column, and the two `useRating`/`useItemWatchlistStatus` instances drifted apart. A slim fixed title bar appears under the header on phones once the hero scrolls away. The old per-page "facts" list is gone (the Details panel already has it).
- `components/detail/MediaActionPanel.jsx` ("Your activity") replaces the stack of seven self-margined widgets: `RatingSidebar` (hearts 30px on 40px hit areas; rated → "Change"/"Clear" buttons), then a `grid-cols-3` row of `ActionChip`s — `WatchedPanel` (unwatched: one tap logs today; watched: green "Watched · N×" chip opening the rewatch diary as a `Popover` on `md+` / `Sheet` on phones: dated "Log another watch" + history with per-entry remove), `AddToWatchlistButton variant="chip"` (picker is a `Popover`/`Sheet` too — the old absolutely-positioned `min-w-max` toast is gone), Share — then `RatingHistogram`, then `RatingHistoryPanel` + `ObservedRatingsPanel` as consistent collapsible rows. Movie/Show pass `watched` + `watchlist` + `onShare`; Season/Episode/Person only `rating` (or no panel for people).
- `FollowButton` and `MediaCard`'s pill show "✓ Following ✕" on every device (no hover-only label swap). `CastGrid` scales avatars 56→80px with 3/4/5/6/8 columns. `WhereToWatch` region tabs and `PersonPage` filmography filters use `PillTabs`.

### Responsive sweep (2026-09 redesign, phase 7)

- Every remaining page now uses `PageContainer` + `PageHeader` + shared `EmptyState`/`ErrorNote`/`Skeleton`/`LoadMoreButton`: Watchlists (`PillTabs` list tabs, `PosterGrid`, `Modal` delete confirm), Follows (`PillTabs` with counts, 2-col grid at `lg`), Collections/Collection (`PosterGrid`; the collection page uses `DetailPageLayout`), My Services (tier from `useCurrentUser`, `EmptyState` gates), Home (`SkeletonPosterRow`), Notifications / Activity / Observe lists & requests / Find People, Updates (editor role from `useCurrentUser`).
- `SubscriptionPage`: the two 5-column tables render as one card per plan below `md` and as cards per reward situation below `sm`. `Footer` links are a 2/4-column grid on phones with `pb-safe`; `Breadcrumbs` match the main padding and scroll instead of wrapping; `EarlyAdopterBanner` is a one-line strip on phones; `AuthPromptModal` and `MediaSearchModal` are `Modal`s (full-screen on phones). Calendar `max-h` uses `svh`.

### Admin (2026-09 redesign, phase 6)

- `pages/admin/AdminPage.jsx`: grouped sidebar from `lg`, a scrollable grouped chip strip below; breadcrumbs name the current page. Every admin page uses `PageHeader size="sm"`, `Button`, `Badge`, `ErrorNote`, `Skeleton`, and `components/admin/StatCard.jsx` (`StatCard` + `StatGrid`). Every `<table min-w-…>` is now a `DataTable` (real table `md+`, stacked cards `<md` with `cardActions`): Early Adopters, Referrals, Reward Codes, Audit Log. Reward-code edit/delete/claims and the audit detail are `Modal`s; User Lookup cards link to `/admin/audit-log?user_id=…` (the Worker filter for it lands in phase 8).

### Settings, profile, edit profile (2026-09 redesign, phase 5)

- `pages/app/SettingsPage.jsx` is now a thin composer: `features/settings/hooks/useSettingsData.js` (profile row, blocked list, expiry — tier/EA from `useCurrentUser`) + one component per section in `features/settings/sections/` (`Profile`, `Preferences`, `ContentRegion`, `Streaming`, `HomeRows`, `Privacy`, `Plan`, `Data`, `Account`), each owning its own state and writes exactly as the old 1015-line file did. Shell pieces in `components/settings/`: `SettingsSection` (anchored card, `danger` variant), `SettingsRow` (label + hint left, control right; stacks below `sm`; `stack` for wide controls), `SettingsNav` (sticky side rail at `lg+`, scrollable chips below, IntersectionObserver highlight). `Switch` replaced the 176px `Toggle` everywhere (`Toggle.jsx` deleted); provider tiles are 3/4/5/6 columns with 40px logos; delete-account confirm + done are `Modal`s.
- **Profile banner** (migration 043): `components/profile/ProfileBanner.jsx` renders a 3:1 band of the chosen favourite's **backdrop** (poster fallback — `useProfileData`/`useEditProfile` now put `backdrop_path` on favourite media) at the saved % crop via `lib/profileBanner.js` (`bannerSource`, `cropStyle` — background-size/position maths, no pixel export or upload). `components/profile/BannerPicker.jsx` on `/profile/edit` picks Auto / favourite 1–5 and opens a `react-easy-crop` `Modal` (aspect 3) whose `croppedArea` percentages are saved by `useEditProfile.saveBanner({position, crop})`.
- `ProfilePage`: banner (see above) with the `xl`/`2xl` avatar overlapping it — the content block is `relative z-10` because the positioned banner would otherwise paint over it — name + tier/private badges, member-since, actions as `Button`s, counts row (Observers / Observing / Ratings). Recent ratings grid 3/4/5/6/8 columns; favourites always 5 across. `Avatar` gained `xl` (96px) and `2xl` (128px). `EditProfilePage` uses `SettingsSection` cards; `AvatarPicker` shows a 128px preview with three option cards (Initials / Poster / Photo·Pro) and a `Modal`-based crop step; tier comes from `useCurrentUser`.

### Browse, people, search, adult (2026-09 redesign, phase 4)

- `pages/app/MediaBrowsePage.jsx` is `/movies` and `/shows` (`kind="movie"|"show"`, calls `useMediaBrowse` directly — the two near-identical page files are 5-line wrappers and the per-kind hook wrappers were deleted). `PageHeader` + inline `SearchBar`, `SkeletonPosterRow`, `ErrorNote`.
- `components/home/PosterGrid.jsx` (`POSTER_GRID_CLASS`) is the one poster grid (2 cols at 320, 3 from `xs`, auto-fill 130→150→168→190px). `MediaCard` is fluid (`w-full`); `MediaRow` gives each slot an explicit width (`ROW_SLOT_CLASS`), scroll-snaps on touch with full-bleed edges, and shows hover chevrons only from `lg`. `MediaGrid` = `SectionTitle` + `PosterGrid` + `LoadMoreButton`.
- `PeoplePage` is a responsive card grid (2/3/4/5/6/8 columns) with rank badges; `SearchPage` uses `PillTabs` (type + counts) and a `Select` sort that stacks under the tabs on phones, `PosterGrid` for media and people, `EmptyState`s and `LoadMoreButton`; `AdultPage` has the same toolbar and a `Button`-based interstitial.

### Header, account menu, mobile navigation (2026-09 redesign, phase 1)

- **`features/profile/CurrentUserContext.jsx`** — `CurrentUserProvider` (mounted in `App.jsx`
  inside `PreferencesProvider`, seeded with the profile row App already fetches — `role`,
  `avatar_*`, `referral_code`, `is_private` were added to that select) exposes
  `useCurrentUser()` → `{ username, role, isAdmin, isEditor, tier, isEarlyAdopter, avatar,
  referralUrl, unreadNotifications, setUnreadNotifications, pendingRequests, refresh,
  refreshCounts, loading }`. Tier/EA fetched once; badge counts refresh on every route change.
  `AdminRoute` and `useIsAdmin` read it instead of running their own `profile.role` query.
  Profile writers (avatar/username in `useEditProfile.js`, `SettingsPage.jsx`) call
  `notifyProfileUpdated()` from `features/profile/profileEvents.js` so the header updates live.
- **Information architecture** lives in `components/layout/navigation.js` and is rendered by every
  surface: Browse (Popular · Movies · Shows · People · More ▾ = Collections, My Services, Adult
  when both adult switches are on), Library (Watchlists, Follows, Releases Radar, Import), Social
  (Activity, Find People, Observe Requests [pending badge], Notifications [unread badge]), Account
  (Edit profile, Settings, Plan & rewards), Admin panel (role 4), Sign out.
- **Header** (`Navbar.jsx`): `<md` → ☰ (opens `MobileDrawer`), logo, search icon, bell, avatar
  (signed out: Sign in). `md+` → text nav + More, Radar icon, Register. `lg+` → inline dense
  `SearchBar` (200px, 300px at `xl`). Rotated phones (`landscape-short:`) shrink it to 48px.
- **Account menu** (`AccountMenu.jsx`): click-to-open on every device (the old hover-open /
  click-navigates split is gone). Identity card (links to `/u/:username`) → one "Invite friends"
  row (copy + share) → Library / Social / Account groups → Admin → Sign out. Renders as a
  `Popover` on `md+` and a bottom `Sheet` on phones (the same `AccountMenuContent` is what the
  tab bar's "You" tab opens).
- **`BottomTabBar.jsx`** (`<md`, hidden on rotated phones, `pb-safe`): Home, Browse (opens the
  drawer), Search, Radar (sign-in prompt when signed out), You (account sheet / Sign in). `AppLayout`
  owns the drawer/account-sheet/auth-prompt state and pads the page bottom with `pb-tabbar`;
  `ReportBugButton` sits above the bar and is icon-only `<sm`.

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
- **New follows are blocked once a movie is released or a show has ended** (`lib/followGate.js` `movieFollowBlock`/`showFollowBlock`) — client-side only, since the DB can't know TMDB release dates. Existing follows are never affected: nothing in the calendar/follows read path filters by release/end state, so an already-followed released title keeps showing everywhere. Relies on the Worker card actually carrying `status` for shows — see "Show status backfill" above; without it every show on a browse row looks un-ended regardless of its real state.

---

## Recent Fixes & Features

**2026-09-05 audit log: cover every user/admin action (migrations 044/045, 2026-redesign phase 8):**

- Before this, `audit_events` only had two Worker-side writers (`referral`, `rewards`) and the follow/unfollow DB triggers from migration 002 — roughly 2 of 18 Worker mutations and none of the ~75 direct-Supabase writes (ratings, watch log, watchlists, favourites, profile/settings, social) were recorded. Migration 044 closes both gaps: see its row in "Migration History" above for the full trigger/column list.
- **Worker side:** `audit.js`'s `auditLog(action, fields=[])` middleware changed its default from *record the whole body* to *record nothing unless a field is explicitly allowlisted* (a footgun — any route that ever carries a secret would have logged it) and now also records `status`, `source='worker'`, and whatever a handler attaches via `setAudit(c, {targetUserId, extra})`. Applied to all 16 previously-unaudited routes: every `admin/users.js` and `admin/rewardCodes.js` write, `announcements.js`/`admin/announcements.js` create/edit/archive/restore/delete, and `import.js`'s `/resolve` (counts only) and `/commit`. `import.js`'s `/commit` was restructured to run its `user_rating`/`watchlist_item` inserts inside one `sql.begin()` transaction (previously separate statements) so a single `SET LOCAL watchpapa.audit_skip='1'` reliably suppresses the DB row-triggers for the whole batch — the route logs one `import_committed` summary row instead; this also made the batch atomic, a side effect of the audit work worth knowing about.
- **New registry:** `worker/src/auditActions.js` (~65 actions grouped by account/privacy/social/ratings/lists/rewards/import/admin/content) backs `GET /api/admin/audit-log/actions`; the audit-log route now 400s on an unknown `action`/`source` filter instead of silently ignoring it, and gained `user_id`/`target_user_id`/`path`/`source` filters. A new read-only `GET /api/admin/audit-log/auth` tab reads Supabase's own `auth.audit_log_entries` (sign-in/out, OAuth, password recovery, token refresh, user deletion) — the Hyperdrive role already has `SELECT` on it, confirmed before assuming a grant was needed.
- **DB side (migration 044):** one generic `SECURITY DEFINER` trigger (`audit_row_change()`) on 9 user-data tables, a `profile` trigger emitting one row per changed *group* (never the whole row) plus `account_deleted` on soft-deletion, and a statement-level trigger so clearing 50 notifications is one `notifications_cleared` row, not 50. `audit_events` gained `status`/`target_user_id`/`source` + 3 indexes.
- **Hotfix (migration 045):** `audit_notifications_cleared()`'s actor fallback used `min(recipient_id)`, but Postgres has no `min()` aggregate for `uuid` — every bulk notification clear raised `function min(uuid) does not exist` and rolled back until this was caught by `tests/rls_tests/audit_triggers.test.js` and fixed with `(array_agg(recipient_id))[1]`.
- **Verification:** `worker/test/audit.test.js` (middleware + registry, 7 tests) and the new `tests/rls_tests/audit_triggers.test.js` (6 tests, run with rolled-back transactions against live Postgres as the `authenticated` role) both green. The pre-existing `rls_policy_isolation.test.js` has one unrelated failure (`User B cannot SELECT User A profile`) predating this work by months (May 2026) — profiles are now intentionally publicly viewable (`/u/:username`), the test just never got updated for that.
- `AuditLogPage.jsx`/`useAuditLog.js` rewritten: App events / Auth events tabs, filters and action colours driven entirely by the registry (no more hard-coded `ACTIONS`/`ACTION_COLOR`), row → detail modal, "Open in User Lookup" link.

**2026-09-05 footer pages refresh + feature announcement:**

- `pages/app/static/StaticInfoPages.jsx` (About / Help / Terms / Contact / Privacy) and `SubscriptionPage.jsx` rewritten against the real feature set: live-TMDB architecture (no DigitalOcean, Cloudflare hosts site + API), JustWatch attribution, language/region/title-mode settings, Where to watch + watch regions (all tiers) vs streaming-service picking / My Services / "On Your Services" rows (Pro+), Suggested for you (seeds = ratings ≥6 + watched), home-row customisation, unified `/search`, collections + certifications, rewatch diary, rating history + "Add new rating", avatars (poster any tier, upload Pro+), poster download, filmography controls, follow gating, adult-content controls (18+ via DOB, NSFW keyword filter, blur, Adult tab), observe/activity/notifications/private/block, share cards, Letterboxd import / CSV export, OAuth (Google/GitHub), 90-day username cooldown, delete account. Plans table gained Watchlists / Profile stats / Streaming services / Custom avatar rows. Dropped the unverifiable "referral must complete within 30 days" claim (no expiry job exists — `referrals.status='expired'` is never set); the friend's tasks are 3 follows + 2 sign-in days (`check_referral_tasks`). `<li>` contents are wrapped in `<span>` because `InfoPageShell` makes each `li` a flex row for the accent bullet — mixed text + `<strong>` children would otherwise become separate flex items.
- **Announcement drafted in the `announcements` table as `archived = true`** (title "🌍 Streaming, suggestions, your language & a rewatch diary — the biggest update yet", author = admin). Left hidden on purpose: at the time of writing `production` was 3 commits ahead of `origin/production` (My Services/collections/certifications, rewatch diary/rating history, RLS audit), so publishing would have announced undeployed features. Publish after deploy via `/admin/announcements` → restore, or `UPDATE announcements SET archived = false, updated_at = now() WHERE archived AND title LIKE '🌍 Streaming%'`. Body HTML also saved at the session scratchpad `announcement-2026-09.html`. Post style convention (matches the two earlier posts): emoji `<h2>` per feature, `<ul><li><p>` lists (RichTextEditor output shape), `<hr>` + sign-off line.

**2026-09-05 RLS/access-control audit (migration 042):**

- Every `public` table confirmed RLS-enabled with correctly-scoped policies (cross-checked migration files against live `pg_policies`/`pg_class` and the Supabase security advisor, not just the SQL source — `profile`/`handle_new_user` live entirely outside the migrations folder, created directly in the dashboard). Two real gaps found and fixed:
- **Three SECURITY DEFINER trigger functions were callable via `/rest/v1/rpc/<name>` by `anon`/`authenticated`** — `guard_avatar_tier()` (033), `guard_watch_providers_tier()` (034), `log_user_rating_change()` (039) each only did `REVOKE ALL ... FROM PUBLIC`, which doesn't touch the direct EXECUTE grant Supabase's default privileges give anon/authenticated on every new function (the `PUBLIC` pseudo-role and a direct per-role grant are separate). Sibling trigger functions (018, 020) already followed the correct pattern — `REVOKE EXECUTE ... FROM anon, authenticated`. Not practically exploitable (Postgres refuses to run a `RETURNS TRIGGER` function outside trigger context) but inconsistent and advisor-flagged. Fixed for these three plus two pre-existing dashboard-only functions (`handle_new_user`, `clean_audit_events_on_profile_delete`).
- **`reward_codes`'s "active codes read" policy (009) let any authenticated user `SELECT` every active/unexpired promo code's literal value** — no frontend reads this table and no redeem/claim RPC exists yet anywhere in the migrations, so it served no purpose except letting any user list and pre-empt codes meant for controlled/individual distribution. Dropped; a future redeem flow should validate a submitted code via a SECURITY DEFINER RPC (same pattern as `can_view_ratings` gating `user_rating`) instead of exposing the table.

**2026-09 My Services page, infinite "Suggested for you", collections, certifications:**

- **New `/my-services` page** (`MyServicesPage.jsx` + `features/myServices/hooks/useMyServicesPageData.js`) — the full browse-page version of the "…On Your Services" home rows: merged movie+show Popular, Top Rated (`sort=rated` on `/discover/:type` — the param already existed, unused outside the `/adult` page until now), Suggested For You (`resultsOnMyServices` from `/api/content/recommendations`, paginated), and one **"Popular on `<service>`"** row per provider the user picked (not personalized — same discover mechanism as Popular, just `with_watch_providers` narrowed to that one provider; provider names via `useWatchProviderList()`). Gated on Pro+ tier + at least one provider/region picked (same rule as picking providers at all in Settings) — shows an upgrade or setup prompt otherwise. Linked from a new `Navbar.jsx` nav item, ordered Popular/Movies/Shows/Collections/People/My Services/Search.
- **"Suggested for you" is now real infinite scroll**, not a fixed 24-item cap. `POST /api/content/recommendations` accepts an optional `page` (default 1) and re-fetches each seed's TMDB `/recommendations` at that TMDB page instead of always page 1. The endpoint stays stateless/per-user/never-edge-cached, so the Frontend (`useHomeData.js`) keeps a running set of every id already shown and folds it into `exclude` on each call — that's what keeps later pages from repeating earlier ones. `hasMore` flips false once a page comes back empty (that seed pool is exhausted). Both home rows ("Suggested For You" and "Suggested For You · On Your Services") and the My Services page's own Suggested row use this.
- **TMDB collections wired up, as two pages** — new `GET /api/content/collection/:id` (+ `/collection/:id/translations` as an overview-fallback source, same spirit as the movie/show detail routes' extra en-US fetch) backs `/collections/:id` (`CollectionPage.jsx`, a `MediaGrid` of the collection's films with real follow state). `normalizeMovie()` passes `belongs_to_collection` through as `collection` (free — already in the `/movie/{id}` response); `MoviePage.jsx` links to it. New `/collections` is a **search** page (`CollectionsPage.jsx` + `features/collection/hooks/useCollectionSearch.js` + new `GET /api/content/search/collections` wrapping TMDB `/search/collection`) — TMDB has no "browse all collections" endpoint, so there's no default list, only search results (new `components/detail/CollectionCard.jsx`, poster+name only). TMDB collections are movie-only.
- **TMDB certifications wired up** — new `GET /api/content/certifications` wraps `/certification/{movie,tv}/list` (static reference data, cached 7d). Per-title certification comes free off data already fetched: movie detail already appends `release_dates` (which carries `certification` per release), and the show detail route now also appends `content_ratings`. `normalize.js` `certificationForRegion()` picks the value for the same `region` used for regional release dates; `MoviePage.jsx`/`ShowPage.jsx` render it as a "Certification:" label + badge next to Genres, with the TMDB `meaning` as a tooltip (`lib/certifications.js`). Detail pages only — not added to list/discover/batch cards (would need a new `append_to_response` on every browse call for a feature that wasn't asked for there). The badge links to a new footer page, `/certifications` (`CertificationsInfoPage` in `StaticInfoPages.jsx`), explaining what a certification is with a per-country lookup table built from the same catalog endpoint.
- 6 new `worker/test/normalize.test.js` cases for `certificationForRegion`/`collection`/`normalizeCollection`; full worker suite (66 tests) and `Frontend` build verified green; new endpoints hand-verified against live TMDB via `wrangler dev`.

**2026-09 hidden "Adult" page + NSFW poster blur:**

- **New `/adult` route + Navbar link, behind two switches** — "Show adult content" (`showAdult`, migration 032) is the *general* switch: nsfw titles appear inline in browse/search/home. The "Adult" header tab is a *separate* opt-in on top of it (`showAdultTab`, migration 037, default off — Settings → Preferences → "Adult tab in header", only offered once `showAdult` is on). The nav item (styled red, desktop row + mobile menu) renders only when **both** are on; `AdultPage.jsx` self-guards the same way (`<Navigate to="/" replace />`), since a direct/bookmarked URL visit skips the Navbar entirely. First visit (per browser tab — `sessionStorage`) shows a warning interstitial ("You're about to view adult content" + continue/back) before any poster renders; posters on this page are never blurred (`MediaCard`'s `blurDisabled` prop) since the warning is the gate here, not the blur.
- **`/adult` page = one filterable/sortable grid** (`features/adult/hooks/useAdultPageData.js` + `MediaGrid`, follow + load-more wired): type pills (Movies/Shows), a category `<select>` (NSFW keyword categories from `/api/content/adult/categories` — Adult film / Adult parody / Softcore / Erotic / Pink film / Hentai / Sexploitation — plus the regular genres for the current type, applied *within* adult titles), and a sort `<select>` (Most popular / Highest rated / Newest). Still no home-page-style reordering/customization — it's a browse, not a second home page.
- **Worker: `/discover/:type` gained `adult_only=1` / `keyword=` / `sort=`** (`tmdb/discover.js` `discoverParams`, `parseDiscoverSort`; `nsfw.js` `withKeywordsParam()`, `NSFW_CATEGORIES`, `parseNsfwKeywordIds()`). `adult_only` passes `with_keywords` = the curated NSFW set (or one validated category subset) instead of excluding it. Free correctness property: `discoverParams()` still adds its own `without_keywords` whenever `include_adult` is off, and since both params carry the *same* ids, TMDB returns zero matches unless the request already has adult content on — no separate gate needed. `sort=rated` adds a `vote_count.gte=20` floor so two-vote 10/10s don't top the list. (An earlier iteration used two `LIST_KINDS`, `adult-movies`/`adult-shows`; replaced by these params once the page needed categories + sorting.)
- **Where to watch: "available in other countries"** — `components/detail/WhereToWatch.jsx` now knows the difference between "user picked no regions" (unchanged: plain region `<select>`) and "user picked regions but this title streams in none of them": the latter shows an amber notice naming the missing countries + a "See where it's available" button opening a popup over every region that *does* have data — ←/→ buttons or arrow keys step through countries, a search box jumps to one by name or code, and the Stream/Free/Rent/Buy buckets render identically to the main panel (shared `RegionBuckets`). When the chosen regions do have data, a small "Other countries (N)" link in the footer opens the same popup over the remaining ones. Country names come from `useWatchRegionCatalog()` (TMDB `/watch/providers/regions`), falling back to `Intl.DisplayNames`. The popup is **portaled to `<body>`** — `ContentPanel` uses `backdrop-blur`, which makes the panel the containing block for `position:fixed`, so rendered in place the overlay was clipped to the panel and sat under the sections below it. Any future modal opened from inside a `ContentPanel` needs the same `createPortal`.
- **NSFW poster blur** — new `profile.setting_blur_nsfw_posters` (migration 036, default `true`) / `usePreferences().blurNsfw`. `MediaCard` gained an `nsfw` prop (threaded through `useHomeData`/`useMediaBrowse`/`SearchPage` card-item builders) — when `nsfw && blurNsfw`, the poster renders blurred with a per-card "18+ · Tap to reveal" overlay (click un-blurs just that card, doesn't touch the setting). Settings gained a "Blur NSFW posters" toggle, shown only once "Show adult content" is on. The `/adult` page opts every card out via `blurDisabled` (see above) — blurring adult titles on the page that exists specifically to show them would be pointless.
- **Fixed: no way to unlock "Show adult content" at all for some accounts** — both that toggle and the new Adult tab are gated on `profile.is_adult`, which `App.jsx` only ever auto-computes (age ≥18) from `profile.date_of_birth` — and there was **no UI to set `date_of_birth` after signup** if it came back empty (older OAuth sign-ins mainly; `date_of_birth` has been nullable for Google/GitHub since migration 028, with the intent that `/complete-username` collects it, but that page only triggers for a missing *username*, not a missing DOB). New "Date of birth" row in Settings → Profile: a one-time date input when it's unset (writes `date_of_birth` + the derived `is_adult` together, so the "Show adult content" row unlocks immediately, no reload), read-only display once saved. No RLS/trigger change needed — `profile_update_own` and the `guard_profile_sensitive_columns` deny-list (migration 010, `role`/`referral_code` only) already allow it.

**2026-09 header search redesign + unified `/search` results page:**

- **Header search is now split by breakpoint** instead of one icon-toggle everywhere: at `lg:`+ (desktop) a thin, always-visible `SearchBar` sits at the right edge of `Navbar.jsx` (new `dense` prop — smaller padding/text/icon insets — and `maxWidthClass` prop so the Navbar instance can be narrower than the default 560px inline usages); below `lg:` it stays the icon-toggles-a-full-width-dropdown-panel pattern from the original header-search change (now `lg:hidden`). Both the results dropdown and the mobile toggle panel are solid (`bg-[#141728]` / `bg-[#0d0f1e]`, no opacity/blur) — the previous translucent dropdown was hard to read over page content.
- **Fixed: the dropdown reopening itself on `/search`** — `SearchBar` mounts with a non-empty `value` there (from the URL's `?q=`), and the old open-condition (`trimmed.length >= 2 && status !== "idle"`) was satisfied purely by that prop, popping the suggestions open on every load/navigation on top of the full results grid already on the page. Fixed with a `hasInteracted` gate (only set `true` inside the input's own `onChange`/`onFocus`) — the dropdown now only opens in response to an actual keystroke or focus, never from a prop-derived value alone. On top of that, `SearchPage`'s own `SearchBar` now passes `showDropdown={false}` — the typeahead dropdown is pointless there since the full results are already rendered below it.
- **`/search` results page rewritten** — previously three fixed Movies/Shows/People sections, each capped at 15 items with no sort/filter/pagination. Now one unified movies+shows grid ordered by relevance by default (TMDB's own `/search/multi` ranking), with a type filter (All/Movies/Shows/People, `FollowsPage`-style pill tabs, counts per type) and a client-side sort select (Most relevant/Popularity/Highest rated/Newest/Title A-Z — TMDB search has no server-side `sort_by`), plus a "Load more" button backed by real pagination instead of a hard cap. **People stay in their own section** below the media grid (poster cards and person cards don't mix well, and rating/date sorts mean nothing for a person) — still relevance-ordered, still part of the same paginated result set.
- **Worker: `/api/search` now calls TMDB's `/search/multi`** instead of three separate `/search/{movie,tv,person}` calls merged and capped client-side — one call already returns a relevance-ranked, type-mixed list with native `page`/`total_pages`. `normalizeSearchResults()` was rewritten for the new single-response shape (`worker/src/tmdb/normalize.js`); order is preserved as-is (that TMDB ranking *is* the "most relevant first" behavior). See API Route Map above for the new response shape.
- **`useSearch.js`** no longer re-sorts by popularity client-side (trusts the Worker/TMDB order) and now tracks `page`/`totalPages`, exposing `hasMore`/`loadMore`/`isLoadingMore` alongside the existing `{results, isLoading, status}` shape so `SearchBar`'s dropdown (which just caps to 8 and ignores pagination) didn't need to change its consumption pattern.
- **Search results now carry follow-gating too** — `SearchPage`'s `MediaCard`s pass `followBlockedLabel={followBlock(item.type, item)}` (see "Follow gating" below), same as browse/home rows. TMDB's `/search/multi` never returns a show's `status`, so `/api/search` runs the same `backfillShowStatus()` used for browse/discover rows (generalized with an `idKey` param since search results key the tmdb id under `tmdbId`, not `id`) — one bounded, edge-cached `/tv/{id}` lookup per show result missing `status`, capped by the existing `SHOW_STATUS_BACKFILL_MAX` wrangler var. Released movies and ended/canceled shows are both gated on `/search`, same as everywhere else.

**2026-09 search moved into the header:** a magnifying-glass icon in `Navbar.jsx` (always visible, both logged-in and guest) toggles a full-width dropdown panel holding the existing `components/home/SearchBar.jsx` — same interaction on phone and desktop, no separate mobile-only treatment needed since the panel is just full-width by default. Closes on route change (picking a result or hitting Enter), an outside click (reuses the header's existing click-outside effect), or Escape. `SearchBar` gained an `autoFocus` prop (default off, so its other inline usages on `AppHomePage`/`MoviesPage`/`ShowsPage` are unaffected) so the input is focused the moment the dropdown opens.

**2026-09 fix: ended/canceled shows still followable from browse rows:**

- Root cause: TMDB's list/discover/recommendations responses never include a show's `status` — only the full `/tv/{id}` detail payload does. Every browse row (Popular, Popular · On Your Services, Coming Soon, Movies/Shows, Suggested For You) builds its show cards from list-shaped data, so `card.status` was always `null` and `lib/followGate.js` `showFollowBlock()` could never detect an ended/canceled show (e.g. Better Call Saul stayed "Follow"-able everywhere except its own detail page, which does use full detail).
- Fix: new `tmdb/discover.js` `backfillShowStatus()` — one bounded extra `/tv/{id}` lookup per show card missing `status`, edge-cached at `TTL.show` so it's cheap after the first cold hit for a popular title. Wired into `runDiscover()` (covers every discover-backed row), the non-discover `/list/:kind` branch, and `/api/content/recommendations`. New wrangler var `SHOW_STATUS_BACKFILL_MAX` (20); `RECOMMENDATIONS_PROVIDER_CHECK_MAX` lowered from 25 to 15 to keep the combined subrequest count under the Free-plan ceiling. 3 new tests in `worker/test/discover.test.js`.

**2026-09 home page customization + "mark as watched" + fixes:**

- **"Popular on my streamings" renamed to "Popular · On Your Services"** to match "Suggested For You · On Your Services" — both now follow one `· On Your Services` suffix convention (`lib/homeRows.js` `HOME_ROW_LABELS`).
- **Home page rows are now user-controllable** — migration 035 adds `setting_home_row_order`/`setting_home_hidden_rows` to `profile`. New `lib/homeRows.js` is the row registry (stable keys, default order, labels — keys are independent of display text so a rename never breaks a saved order); `AppHomePage.jsx` renders `effectiveHomeRowOrder(homeRowOrder)` filtered by `homeHiddenRows` instead of a hardcoded array. New "Home page" section in Settings (`HomeRowsEditor`) with up/down reorder buttons and a show/hide toggle per row — no drag-and-drop dependency, free for every tier.
- **Rewatch diary (`watch_log`, migration 038) — superseded the original "mark as watched" boolean.** `watchlist_item.watched` existed since migration 016 but had no UI (confirmed by audit) until a first pass added a simple toggle; that toggle was then replaced with a full diary once product feedback asked for a manual undo and a rewatch counter/history. Each (re)watch is one dated `watch_log` row. `components/watchlist/WatchedPanel.jsx` (sidebar, `MoviePage`/`ShowPage`, between `RatingHistogram` and Share) renders: not-watched → "Mark watched" button; watched → a "Watched" badge (only appends "· N×" once N≥2 — a single watch just says "Watched") with a persistent "+" (always visible, logs another watch via an inline date picker, defaults today, capped at today — not nested behind a dropdown) and, only once there's at least one dated entry, a separate chevron toggle that expands the per-entry history with a per-entry remove (✕). `features/watchlist/hooks/useWatchLog.js` is the CRUD hook (`entries`, `count`, `logWatch(date?)`, `removeEntry(id)`). Logging a watch always deletes any `watchlist_item` row for that title across all the user's watchlists (mirrors `removeFromWatchlistsOnRating.js`'s "rated ⇒ opinion formed" convention, now generalized to "watched ⇒ off the to-watch list") and dispatches the same `watchpapa:watchlist-item-removed` event so `AddToWatchlistButton`'s pill updates live. Re-adding a watched title to a watchlist (`AddToWatchlistButton`'s auto-add, or `useItemWatchlistStatus.js`'s per-list checklist) upserts on `(watchlist_id, media_type, tmdb_id)` rather than plain-inserting, since a legacy `watched=true` row can already occupy that slot. `WatchlistsPage.jsx`'s `ItemGridCard` "Mark watched" button calls `useWatchlistItems.js`'s `markWatched(itemId)`, which does the same log-and-remove — one-directional from that view (undo only happens via `WatchedPanel` on the detail page).
- **Rated ⇒ shown as watched, but never permanently.** Rating something seeds the first `watch_log` entry once (`features/watchlist/lib/watchLog.js` `ensureWatchLogSeed`, called from `useRating.js`'s `setRating` — reordered to run *before* `removeFromWatchlistsOnRating` in the same call, since `useWatchLog.js` reloads on the `watchpapa:watchlist-item-removed` event that removal dispatches, and the seed row needs to already exist when that reload fires). It's a no-op if a log entry already exists, so it never fabricates a rewatch on a later re-rating, and it's never re-seeded after that — **`WatchedPanel`/`useWatchLog.js` trust `count` alone once loaded** (`impliedWatched` — from a rating, or `useShowCompletion.js`'s show-fully-rated-via-seasons/episodes case — is only a same-tick placeholder while `loading` is still true, so rating something shows "Watched" instantly instead of flashing "Mark watched" first). This split matters: an earlier version had `useWatchLog.js` itself auto-re-insert an entry any time it saw `impliedWatched` true with nothing logged, which meant a rated title could never be shown as unwatched again — removing its one log entry just brought it right back. Legacy ratings that predate `watch_log` are handled once, up front, by migration 040's backfill instead of a live per-render check. A show counts as rated via `useRating("show", …)` **or** `useShowCompletion(showId, seasons, session)`, which treats a show as fully rated once every real (non-special) season is covered by a season-level rating or a full set of episode-level ratings — without the show entity itself ever being rated (note: unlike direct movie/show ratings, this path has no `ensureWatchLogSeed` equivalent, so such a show only gets a real logged date once the user manually logs one or rates the show directly). See "Suggested for you" above for the matching exclude-list change.
- **Rating history (`user_rating_history`, migrations 039 + 041).** A `log_user_rating_change()` trigger on `user_rating` (SECURITY DEFINER, same convention as `audit_user_follow_change`) logs the initial value and every later change — not clears. `components/rating/RatingHistoryPanel.jsx` (right under `RatingSidebar`) only renders once there are **2+** entries (i.e. the rating has actually changed at least once); a never-edited rating has nothing to add beyond what `RatingSidebar` already shows. Each entry has a remove (✕) — `features/rating/hooks/useRatingHistory.js`'s `removeEntry(id)`, backed by migration 041's own-row DELETE policy (039 only allowed clients to SELECT) — which edits the historical record only, dropping back below the 2-entry threshold hides the panel again.
- **`RatingSidebar.jsx` no longer lets a stray click silently overwrite an existing rating.** Once rated, the hearts go static (no hover-preview, no click handler) and two buttons appear instead: "Add new rating" (re-enables the live hearts to pick a new value — same interaction as the initial, unrated state) and "Clear rating". Unrated titles are unaffected — hover/click still sets the rating directly, same as before.
- **Fixed a duplicated release-date display** on `MediaCard` — the gold "NOV 2026" pill overlay and the text line below the title both rendered `releaseLabel` for upcoming titles; the text line now only shows for the "Airing" case, which has no pill.

**2026-09 "Suggested for you" recommendations + streaming-provider Pro+ gate:**

- New `POST /api/content/recommendations` — no ML of our own, aggregates TMDB's own `/movie|tv/{id}/recommendations` across the user's seed titles, ranked by cross-seed hit count. New `features/home/hooks/useSuggestionSeeds.js` (ratings ≥6/10 + watched watchlist items → seeds; every rated/watchlisted/followed title → exclude list) and two new home rows in `useHomeData.js`/`AppHomePage.jsx`: **"Suggested For You"** and **"Suggested For You · On Your Services"** (the same ranked list, filtered to titles on the user's chosen providers — Pro+ only by inheritance, see below). New wrangler vars `RECOMMENDATIONS_MAX_SEEDS` (8) / `RECOMMENDATIONS_PROVIDER_CHECK_MAX` (25) bound the Worker's subrequest cost. No DB migration — reads only existing `user_rating`/`watchlist_item`/`user_followed_*` tables.
- **Choosing specific streaming services ("My streaming services" in Settings) is now Pro/Pro+/God only** — migration 034 `guard_profile_watch_providers_tier` trigger rejects the write server-side, not just a UI lock. Watch *regions* stay open to every tier. This is also why the new "…On Your Services" row and the earlier "Available on your services" / "Popular on my streamings" rows are all effectively Pro+-only: they only render once providers are set.

**2026-09 user avatars:**

- New `profile.avatar_type` (`default`\|`poster`\|`upload`, migration 033). Default is the plain username-initial circle the app always used; any tier can pick a TMDB **movie or show** poster as their avatar (`components/ui/MediaSearchModal.jsx`, shared with `FavouritesEditor.jsx`; `AvatarPicker.jsx` originally restricted this to movies only, lifted since — the DB column, the modal, and `useEditProfile.js` never actually enforced that restriction, it was UI-only); Pro/Pro+/God can upload and crop a custom photo (`react-easy-crop`, `components/profile/AvatarPicker.jsx`, `lib/cropImage.js`) to the new public `avatars` Storage bucket. Tier is enforced server-side by both a `guard_profile_avatar_tier` trigger and the bucket's own RLS — the client-side lock is UI-only. (A generated-identicon default was tried and replaced with plain initials — not liked.)
- New shared `components/ui/Avatar.jsx` replaces the old "first letter in a circle" initials rendering in `ProfileMenu`, `ProfilePage`, and `UserResultRow` (search/observer lists — `search_profiles`/`get_observers`/`get_observing` RPCs extended with the avatar columns). Not wired into the activity feed or "who rated this" panel, which show no identity avatar for anyone today and are backed by RPCs that would need their own migration — left as a follow-up.
- New `lib/tier.js` `isProTier()`/`isPremiumTier()` shared helper, introduced for the upload tier-gate; four pre-existing duplicate tier-check spots elsewhere were left alone (out of scope for this change).

**2026-09 content locale, watch providers, NSFW filtering, filmography controls, follow gating:**

- **Content language + title mode + region** — new `profile` columns (migration 032) and `features/preferences/PreferencesContext.jsx`. Worker: `tmdb/locale.js` `readLocale()`, `client.js` threads `language` through `buildUrl` (position kept stable for the edge cache key), `normalize.js` `pickTitle()`/`pickRegionalRelease()`. New `GET /api/content/config/locales`. Frontend `lib/api.js` appends `lang`/`region`/`native` to every content/search request; `useContent`/`useContentBatch` caches are locale-keyed.
- **Watch providers ("Where to watch")** — movie/show detail + batch append `watch/providers`; `normalize.js` `compactWatchProviders()`. New `GET /api/content/watch/regions` + `GET /api/content/watch/providers`. New `components/detail/WhereToWatch.jsx` panel on `MoviePage`/`ShowPage`; new "Available on your services" row on `/movies`/`/shows` (`useMediaBrowse.js`) and "Popular · On Your Services" on `/` (`useHomeData.js`), both via `/discover/:type?with_watch_providers=`. Settings gained region-chip + provider-grid pickers — **picking specific providers is Pro/Pro+/God only** (migration 034 `guard_profile_watch_providers_tier`; watch regions stay open to all tiers). JustWatch attribution throughout per TMDB's terms. No subtitle/audio-language availability data exists in TMDB's free API — not implementable.
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
