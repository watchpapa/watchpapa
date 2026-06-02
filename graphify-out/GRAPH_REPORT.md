# Graph Report - .  (2026-06-02)

## Corpus Check
- 297 files · ~299,555 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1401 nodes · 2569 edges · 113 communities (72 shown, 41 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Script Infrastructure|Script Infrastructure]]
- [[_COMMUNITY_Episode Page UI|Episode Page UI]]
- [[_COMMUNITY_Settings Page|Settings Page]]
- [[_COMMUNITY_Admin Dashboard|Admin Dashboard]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_TMDB TV Ingestion|TMDB TV Ingestion]]
- [[_COMMUNITY_Express API Server|Express API Server]]
- [[_COMMUNITY_Follows & Social|Follows & Social]]
- [[_COMMUNITY_Backend Dependencies|Backend Dependencies]]
- [[_COMMUNITY_Profile Generation|Profile Generation]]
- [[_COMMUNITY_Movie Ingestion|Movie Ingestion]]
- [[_COMMUNITY_Search & Discovery|Search & Discovery]]
- [[_COMMUNITY_Watchlist Management|Watchlist Management]]
- [[_COMMUNITY_Person Search|Person Search]]
- [[_COMMUNITY_Auth & Middleware|Auth & Middleware]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Data Sanitization|Data Sanitization]]
- [[_COMMUNITY_Rate Limiting|Rate Limiting]]
- [[_COMMUNITY_Module 18|Module 18]]
- [[_COMMUNITY_Module 19|Module 19]]
- [[_COMMUNITY_Module 20|Module 20]]
- [[_COMMUNITY_Module 21|Module 21]]
- [[_COMMUNITY_Module 22|Module 22]]
- [[_COMMUNITY_Module 23|Module 23]]
- [[_COMMUNITY_Module 24|Module 24]]
- [[_COMMUNITY_Module 25|Module 25]]
- [[_COMMUNITY_Module 26|Module 26]]
- [[_COMMUNITY_Module 27|Module 27]]
- [[_COMMUNITY_Module 28|Module 28]]
- [[_COMMUNITY_Module 29|Module 29]]
- [[_COMMUNITY_Module 30|Module 30]]
- [[_COMMUNITY_Module 31|Module 31]]
- [[_COMMUNITY_Module 33|Module 33]]
- [[_COMMUNITY_Module 34|Module 34]]
- [[_COMMUNITY_Module 35|Module 35]]
- [[_COMMUNITY_Module 36|Module 36]]
- [[_COMMUNITY_Module 37|Module 37]]
- [[_COMMUNITY_Module 38|Module 38]]
- [[_COMMUNITY_Module 39|Module 39]]
- [[_COMMUNITY_Module 40|Module 40]]
- [[_COMMUNITY_Module 41|Module 41]]
- [[_COMMUNITY_Module 42|Module 42]]
- [[_COMMUNITY_Module 43|Module 43]]
- [[_COMMUNITY_Module 44|Module 44]]
- [[_COMMUNITY_Module 45|Module 45]]
- [[_COMMUNITY_Module 46|Module 46]]
- [[_COMMUNITY_Module 47|Module 47]]
- [[_COMMUNITY_Module 48|Module 48]]
- [[_COMMUNITY_Module 49|Module 49]]
- [[_COMMUNITY_Module 50|Module 50]]
- [[_COMMUNITY_Module 51|Module 51]]
- [[_COMMUNITY_Module 52|Module 52]]
- [[_COMMUNITY_Module 53|Module 53]]
- [[_COMMUNITY_Module 54|Module 54]]
- [[_COMMUNITY_Module 55|Module 55]]
- [[_COMMUNITY_Module 56|Module 56]]
- [[_COMMUNITY_Module 57|Module 57]]
- [[_COMMUNITY_Module 58|Module 58]]
- [[_COMMUNITY_Module 59|Module 59]]
- [[_COMMUNITY_Module 60|Module 60]]
- [[_COMMUNITY_Module 61|Module 61]]
- [[_COMMUNITY_Module 62|Module 62]]
- [[_COMMUNITY_Module 63|Module 63]]
- [[_COMMUNITY_Module 64|Module 64]]
- [[_COMMUNITY_Module 65|Module 65]]
- [[_COMMUNITY_Module 66|Module 66]]
- [[_COMMUNITY_Module 67|Module 67]]
- [[_COMMUNITY_Module 68|Module 68]]
- [[_COMMUNITY_Module 69|Module 69]]
- [[_COMMUNITY_Module 70|Module 70]]
- [[_COMMUNITY_Module 71|Module 71]]
- [[_COMMUNITY_Module 73|Module 73]]
- [[_COMMUNITY_Module 74|Module 74]]
- [[_COMMUNITY_Module 75|Module 75]]
- [[_COMMUNITY_Module 76|Module 76]]
- [[_COMMUNITY_Module 78|Module 78]]
- [[_COMMUNITY_Module 79|Module 79]]
- [[_COMMUNITY_Module 80|Module 80]]
- [[_COMMUNITY_Module 81|Module 81]]
- [[_COMMUNITY_Module 82|Module 82]]
- [[_COMMUNITY_Module 83|Module 83]]
- [[_COMMUNITY_Module 84|Module 84]]
- [[_COMMUNITY_Module 85|Module 85]]
- [[_COMMUNITY_Module 86|Module 86]]
- [[_COMMUNITY_Module 87|Module 87]]
- [[_COMMUNITY_Module 88|Module 88]]
- [[_COMMUNITY_Module 89|Module 89]]
- [[_COMMUNITY_Module 90|Module 90]]
- [[_COMMUNITY_Module 91|Module 91]]
- [[_COMMUNITY_Module 92|Module 92]]
- [[_COMMUNITY_Module 93|Module 93]]
- [[_COMMUNITY_Module 94|Module 94]]
- [[_COMMUNITY_Module 95|Module 95]]
- [[_COMMUNITY_Module 96|Module 96]]
- [[_COMMUNITY_Module 97|Module 97]]
- [[_COMMUNITY_Module 98|Module 98]]
- [[_COMMUNITY_Module 99|Module 99]]
- [[_COMMUNITY_Module 100|Module 100]]
- [[_COMMUNITY_Module 101|Module 101]]
- [[_COMMUNITY_Module 102|Module 102]]
- [[_COMMUNITY_Module 103|Module 103]]
- [[_COMMUNITY_Module 104|Module 104]]
- [[_COMMUNITY_Module 105|Module 105]]
- [[_COMMUNITY_Module 106|Module 106]]
- [[_COMMUNITY_Module 107|Module 107]]
- [[_COMMUNITY_Module 108|Module 108]]
- [[_COMMUNITY_Module 109|Module 109]]
- [[_COMMUNITY_Module 110|Module 110]]
- [[_COMMUNITY_Module 111|Module 111]]
- [[_COMMUNITY_Module 112|Module 112]]

## God Nodes (most connected - your core abstractions)
1. `supabase` - 58 edges
2. `tmdbRateLimitedFetch()` - 44 edges
3. `ingestTvShow()` - 26 edges
4. `scripts` - 25 edges
5. `ingestMovie()` - 24 edges
6. `PageHead()` - 21 edges
7. `ingestPerson()` - 20 edges
8. `strOrNull()` - 16 edges
9. `cn()` - 15 edges
10. `str()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Soft Delete Convention` --rationale_for--> `sequelize`  [EXTRACTED]
  CONTEXT.md → Backend/src/db/database.js
- `Nginx Reverse Proxy Configuration` --references--> `Express Application Setup`  [EXTRACTED]
  scripts/nginx-watchpapa.conf → app.js
- `Systemd Service Unit for watchpapa API` --references--> `Express Server Entry Point`  [EXTRACTED]
  scripts/watchpapa.service → index.js
- `searchTmdb` --semantically_similar_to--> `sanitizeMovie()`  [INFERRED] [semantically similar]
  Backend/src/routes/search.js → Backend/src/lib/sanitizeTmdb.js
- `API Proxy Configuration` --conceptually_related_to--> `Root Package Configuration`  [INFERRED]
  Frontend/vite.config.js → package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Authentication & Authorization Middleware Chain** — middleware_requireauth_requireauth, middleware_requireadmin_requireadmin, middleware_requireeditor_requireeditor, middleware_auditlog_auditlog [INFERRED 0.90]
- **TMDB Data Sanitization Pipeline** — lib_sanitizetmdb_str, lib_sanitizetmdb_strnull, lib_sanitizetmdb_clampednum, lib_sanitizetmdb_clampedint, lib_sanitizetmdb_isodate, lib_sanitizetmdb_isolang, lib_sanitizetmdb_sanitizemovie, lib_sanitizetmdb_sanitizeshow [EXTRACTED 1.00]
- **Background Ingestion Deduplication & Logging** — routes_inject_injectrouter, routes_resolve_resolverouter, lib_ingestionqueue_dedupingest, lib_logscriptrun_logscriptrun [INFERRED 0.85]
- **Frontend Build and Development Pipeline** — frontend_vite_config, frontend_postcss_config, frontend_eslint_config, frontend_package, vite_build_tool, tailwindcss_dependency, eslint_linter [EXTRACTED 1.00]
- **Frontend Styling and Design System** — frontend_index_css, frontend_app_css, frontend_styles_globals, design_system_colors, design_system_typography, animations_keyframes, accessibility_reduced_motion [EXTRACTED 1.00]
- **Backend Server Initialization and Configuration** — root_index_js, root_app_js, express_dependency, helmet_dependency, express_cors_middleware, express_body_parser, express_rate_limiting [EXTRACTED 1.00]
- **Form input controls with consistent styling** — components_ui_input_input, components_ui_formfield_formfield, components_ui_otpinput_otpinput, components_ui_toggle_toggle [INFERRED 0.85]
- **Text editing and markdown/rich text functionality** — components_ui_markdowneditor_markdowneditor, components_ui_richtexteditor_richtexteditor [INFERRED 0.80]
- **Page layout and structural organization** — layouts_applayout_applayout, components_layout_navbar_navbar, components_layout_footer_footer, components_layout_breadcrumbs_breadcrumbs, components_static_infopageshell_infopageshell [INFERRED 0.90]
- **API Rate Limiting Strategy** — app_js_global_limiter, app_js_mutation_limiter, app_js_per_user_mutation_limiter, app_js_admin_limiter [EXTRACTED 1.00]
- **API Router Ecosystem** — app_js_search_router, app_js_inject_router, app_js_resolve_router, app_js_import_router, app_js_admin_routes [EXTRACTED 1.00]
- **Server Deployment Stack** — scripts_droplet_setup, scripts_watchpapa_service, scripts_nginx_config, scripts_reboot_notify_service [INFERRED 0.85]
- **Production Deployment Infrastructure** — scripts_droplet_setup, infra_app_user, infra_app_directory, infra_node_runtime, infra_nginx_proxy, infra_ssl_certbot, infra_firewall_ufw [INFERRED 0.85]
- **Systemd Service Units** — scripts_watchpapa_service, scripts_reboot_notify_service, infra_app_user, infra_app_directory [INFERRED 0.85]
- **Monitoring and Alerting System** — scripts_reboot_notify, scripts_reboot_notify_service, monitoring_reboot_notification, monitoring_resend_api [EXTRACTED 0.90]
- **Express Security and Rate Limiting Middleware Stack** — package_express_server, package_security_helmet, package_rate_limit [INFERRED 0.85]
- **PostgreSQL Database Access Layer** — package_sequelize_orm, package_postgresql_driver, package_supabase_integration [INFERRED 0.85]
- **Testing and Data Validation** — package_testing_framework, package_injection_tests, package_rls_tests [INFERRED 0.75]
- **Frontend Technology Stack** — context_react, context_vite, context_react_router, context_tailwind [EXTRACTED 1.00]
- **Backend Technology Stack** — context_nodejs, context_express, context_helmet, context_sequelize [EXTRACTED 1.00]
- **Deployment Infrastructure Stack** — context_cloudflare_pages, context_cloudflare_proxy, context_digitalocean_droplet, context_github_actions [EXTRACTED 1.00]

## Communities (113 total, 41 thin omitted)

### Community 0 - "Script Infrastructure"
Cohesion: 0.05
Nodes (71): withEnvVar(), __dirname, envWithoutTmdbKey(), __filename, repoRoot, runScript(), EMPTY_MOVIE_SCOPE, EMPTY_TV_SCOPE (+63 more)

### Community 1 - "Episode Page UI"
Cohesion: 0.05
Nodes (34): EpisodePage(), fmt(), fmtDate(), fmt(), fmtDate(), fmtMoney(), fmtRuntime(), MoviePage() (+26 more)

### Community 2 - "Settings Page"
Cohesion: 0.05
Nodes (34): SettingsPage(), TIER_COLORS, TIER_LABELS, CompleteUsernameForm(), isAdult(), ForgotPasswordForm(), LoginForm(), getPasswordPolicyStatus() (+26 more)

### Community 3 - "Admin Dashboard"
Cohesion: 0.05
Nodes (25): adminFetch(), ACTION_COLOR, ACTIONS, AuditLogPage(), CatalogStatsPage(), n(), ReferralLeaderboardPage(), DetailModal() (+17 more)

### Community 4 - "Frontend Dependencies"
Cohesion: 0.04
Nodes (46): dependencies, html2canvas, react, react-dom, react-helmet-async, react-markdown, react-router-dom, remark-gfm (+38 more)

### Community 5 - "TMDB TV Ingestion"
Cohesion: 0.10
Nodes (41): buildEmptyShowResult(), buildFullEpisodeWorkItems(), buildTargetedEpisodeWorkItems(), bulkInsertEpisodeCredits(), bulkInsertShowCredits(), collectCreditTasks(), collectEpisodeCreditTasks(), deriveEpisodeNumbers() (+33 more)

### Community 6 - "Express API Server"
Cohesion: 0.06
Nodes (39): Admin API Routes, Express Application Setup, CORS Headers Middleware, Global Rate Limiter, Helmet Security Middleware, Import API Route, Inject API Route, Mutation Rate Limiter (+31 more)

### Community 7 - "Follows & Social"
Cohesion: 0.07
Nodes (21): FollowsPage(), TIER_LIMITS, AgendaView(), buildCalendarDays(), collapseEntries(), DAY_LABELS, DAY_SHORT, DayCell() (+13 more)

### Community 8 - "Backend Dependencies"
Cohesion: 0.05
Nodes (39): dependencies, dotenv, express, express-rate-limit, helmet, pg, pg-hstore, sequelize (+31 more)

### Community 9 - "Profile Generation"
Cohesion: 0.09
Nodes (29): drawAvatar(), drawBadge(), drawBg(), drawDecadeBars(), drawFooterCentered(), drawGenreBars(), drawHistogram(), drawPersonality() (+21 more)

### Community 10 - "Movie Ingestion"
Cohesion: 0.08
Nodes (24): ObserveControls(), ProfilePage(), TIER_COLORS, TIER_LABELS, useObserve(), useObserveCounts(), useProfileRatings(), PREMIUM_TIERS (+16 more)

### Community 11 - "Search & Discovery"
Cohesion: 0.15
Nodes (21): withPatchedMethod(), FAKE_PERSON_PAYLOAD, batchIngestPersons(), departmentCache, ensureTables(), existingPersonIdCache, findExistingPersonId(), FULL_PERSON_REFRESH_SCOPE (+13 more)

### Community 12 - "Watchlist Management"
Cohesion: 0.16
Nodes (23): buildEmptyMovieResult(), bulkInsertMovieCredits(), collectCreditTasks(), ensureTables(), existingMovieIdCache, fetchTmdbMovie(), fetchTmdbMovieCredits(), findExistingMovieId() (+15 more)

### Community 13 - "Person Search"
Cohesion: 0.16
Nodes (20): ALLOWED_ENTITIES, buildFailureErrorDetail(), bulkUpdatePopularity(), ensureTables(), ENTITY_CONFIG, fetchEntityPage(), fetchPopularityForTmdbId(), getApiKey() (+12 more)

### Community 14 - "Auth & Middleware"
Cohesion: 0.15
Nodes (5): initialState, removeFromWatchlistsOnRating(), resolveWatchlistTarget(), consentAwareStorage, supabase

### Community 15 - "UI Components"
Cohesion: 0.14
Nodes (13): BulkResyncSection(), ContentResyncPage(), ResyncPanel(), SCOPE_DEFS, TIME_WINDOWS, TYPE_BADGE, AdminResyncButton(), AdminResyncPanel() (+5 more)

### Community 16 - "Data Sanitization"
Cohesion: 0.10
Nodes (13): router, adminLimiter, allowedOrigins, app, defaultAllowedOrigins, __dirname, globalLimiter, mutationLimiter (+5 more)

### Community 17 - "Rate Limiting"
Cohesion: 0.13
Nodes (15): ALLOWED_TYPES, BULK_TABLE, MOVIE_SCOPE_KEYS, PERSON_SCOPE_KEYS, router, SHOW_SCOPE_KEYS, router, dedupIngest() (+7 more)

### Community 18 - "Module 18"
Cohesion: 0.15
Nodes (14): parseTmdbMovieId(), resolveTmdbIdFromLetterboxdUri(), escapePattern(), getTmdbIdFromUri(), normalizeOptionalRatedAt(), normalizeOptionalUri(), resolveItem(), resolveItemByNameYear() (+6 more)

### Community 19 - "Module 19"
Cohesion: 0.14
Nodes (6): SORT_OPTIONS, WatchlistsPage(), useOverageStatus(), ITEM_SELECT, useWatchlistItems(), useWatchlists()

### Community 20 - "Module 20"
Cohesion: 0.12
Nodes (15): Component hierarchy and composition pattern, AuthPromptModal(), MediaCard Component, Breadcrumbs Component, Footer Component, Navbar Component, InfoPageShell Component, ALL_LINKS (+7 more)

### Community 21 - "Module 21"
Cohesion: 0.37
Nodes (17): clampedInt(), clampedNum(), isoDate(), isoLang(), sanitizeMovie(), sanitizePerson(), sanitizeShow(), str() (+9 more)

### Community 22 - "Module 22"
Cohesion: 0.17
Nodes (5): AboutPage(), ContactPage(), HelpPage(), PrivacyPage(), TermsPage()

### Community 23 - "Module 23"
Cohesion: 0.19
Nodes (7): initialState, initialState, initialState, initialState, DEPT_ORDER, toCast(), toCrew()

### Community 24 - "Module 24"
Cohesion: 0.16
Nodes (9): EMPTY_FORM, RewardCodesPage(), STATUS_BADGE, STATUS_TABS, TIER_LABELS, TIERS, adminFetch(), getToken() (+1 more)

### Community 25 - "Module 25"
Cohesion: 0.17
Nodes (6): EDITOR_ROLES, formatDate(), PostCard(), PostModal(), UpdatesPage(), useAnnouncements()

### Community 26 - "Module 26"
Cohesion: 0.17
Nodes (3): SearchPage(), SearchBar(), useSearch()

### Community 27 - "Module 27"
Cohesion: 0.35
Nodes (11): CookieConsentBanner Component, acceptCookies(), CONSENT, declineCookies(), getConsentStatus(), hasAccepted(), hasMadeChoice(), migrateKeys() (+3 more)

### Community 29 - "Module 29"
Cohesion: 0.18
Nodes (3): parseCsv(), parseCsvLine(), STEPS

### Community 30 - "Module 30"
Cohesion: 0.20
Nodes (11): Express App Factory, getAdminClient(), requireAdmin(), dedupIngest, ingestMovie, ingestPerson, ingestTvShow, Inject Router (+3 more)

### Community 31 - "Module 31"
Cohesion: 0.29
Nodes (6): ObserveListPage(), UserSearchPage(), useObserveList(), useProfileData(), useUserSearch(), UserResultRow()

### Community 33 - "Module 33"
Cohesion: 0.21
Nodes (12): Environment Configuration Management, Express.js Server Framework, Injection Tests Suite, PostgreSQL Database Driver, Express Rate Limiting, Row Level Security Tests, Helmet Security Middleware, Sequelize ORM for Database Access (+4 more)

### Community 34 - "Module 34"
Cohesion: 0.36
Nodes (10): buildUrlset(), fetchAllIds(), getClient(), sendXml(), sitemapIndexHandler(), sitemapMoviesHandler(), sitemapPeopleHandler(), sitemapShowsHandler() (+2 more)

### Community 35 - "Module 35"
Cohesion: 0.24
Nodes (4): AppHomePage(), initialState, mergePopularItems(), useHomeData()

### Community 36 - "Module 36"
Cohesion: 0.31
Nodes (6): NotificationRow(), NotificationsPage(), timeAgo(), useNotifications(), NotificationBell(), notificationContent()

### Community 37 - "Module 37"
Cohesion: 0.22
Nodes (4): lifecycleBucket(), lifecycleLabel(), SORT_OPTIONS, todayKey()

### Community 38 - "Module 38"
Cohesion: 0.18
Nodes (11): Brand Accent Color Scheme, Express 4, Helmet, Monorepo Structure, Node.js ESM, Primary Button Style, React 19, React Router 7 (+3 more)

### Community 39 - "Module 39"
Cohesion: 0.24
Nodes (7): Soft Delete Convention, sequelize, router, escapePattern(), searchLocal(), searchTmdb(), yearFrom()

### Community 42 - "Module 42"
Cohesion: 0.35
Nodes (10): ensureTable(), fetchTmdbJobs(), getApiKey(), logProgress(), normalizeDepartmentName(), normalizeJobName(), renderProgressBar(), saveJobs() (+2 more)

### Community 43 - "Module 43"
Cohesion: 0.35
Nodes (10): buildFailureErrorDetail(), ensureTables(), fetchExistingMovieTmdbIds(), fetchPopularMoviePage(), fetchTopPopularMovieIds(), getApiKey(), ingestPopularMoviesToday(), main() (+2 more)

### Community 44 - "Module 44"
Cohesion: 0.35
Nodes (10): buildFailureErrorDetail(), ensureTables(), fetchExistingPersonTmdbIds(), fetchPopularPeoplePage(), fetchTopPopularPersonIds(), getApiKey(), ingestPopularPeopleToday(), main() (+2 more)

### Community 45 - "Module 45"
Cohesion: 0.35
Nodes (10): buildFailureErrorDetail(), ensureTables(), fetchExistingShowTmdbIds(), fetchPopularShowPage(), fetchTopPopularShowIds(), getApiKey(), ingestPopularShowsToday(), main() (+2 more)

### Community 46 - "Module 46"
Cohesion: 0.35
Nodes (10): buildFailureErrorDetail(), ensureTables(), fetchExistingMovieTmdbIds(), fetchTopRatedMovieIds(), fetchTopRatedMoviePage(), getApiKey(), ingestTopRatedMovies(), main() (+2 more)

### Community 47 - "Module 47"
Cohesion: 0.35
Nodes (10): buildFailureErrorDetail(), ensureTables(), fetchExistingShowTmdbIds(), fetchTopRatedShowIds(), fetchTopRatedShowPage(), getApiKey(), ingestTopRatedShows(), main() (+2 more)

### Community 48 - "Module 48"
Cohesion: 0.27
Nodes (6): ROLE_COLORS, ROLE_LABEL, StaffPage(), adminFetch(), getToken(), useStaff()

### Community 49 - "Module 49"
Cohesion: 0.24
Nodes (3): MoviesPage(), initialState, useMoviesPageData()

### Community 50 - "Module 50"
Cohesion: 0.24
Nodes (3): ShowsPage(), initialState, useShowsPageData()

### Community 51 - "Module 51"
Cohesion: 0.20
Nodes (10): Database Schema, movie table, profile table, show table, Soft Delete Convention, Subscription Tiers, user_rating table, watchlist_item table (+2 more)

### Community 52 - "Module 52"
Cohesion: 0.31
Nodes (9): ALLOWED_KEYS, ALLOWED_TYPES, findLocalId(), resolveMovie(), resolvePerson(), resolveShow(), router, fastUpsertPerson() (+1 more)

### Community 53 - "Module 53"
Cohesion: 0.38
Nodes (9): ensureTable(), fetchTmdbGenres(), getApiKey(), logProgress(), mergeAndDedupe(), renderProgressBar(), saveGenres(), seedTmdbGenres() (+1 more)

### Community 54 - "Module 54"
Cohesion: 0.33
Nodes (6): AnnouncementsPage(), fmt(), PostRow(), adminFetch(), getToken(), useAdminAnnouncements()

### Community 55 - "Module 55"
Cohesion: 0.33
Nodes (3): ObserveRequestsPage(), useObserveRequests(), PageHead()

### Community 57 - "Module 57"
Cohesion: 0.36
Nodes (3): findOrCreateDepartmentId(), normalizeName(), resolveOrCreateJobId()

### Community 58 - "Module 58"
Cohesion: 0.36
Nodes (5): getAdminClient(), requireAuth(), getAdminClient(), requireEditor(), router

### Community 59 - "Module 59"
Cohesion: 0.33
Nodes (7): acquireChain, acquireTmdbSlot(), maskApiKey(), parseRetryAfterMs(), requestTimestamps, sleep(), tmdbRateLimitedFetch()

### Community 61 - "Module 61"
Cohesion: 0.43
Nodes (4): EarlyAdoptersPage(), adminGet(), getToken(), useEarlyAdopterStats()

### Community 62 - "Module 62"
Cohesion: 0.43
Nodes (6): ActivityFeedPage(), entityLink(), FeedRow(), timeAgo(), TYPE_LABEL, useActivityFeed()

### Community 63 - "Module 63"
Cohesion: 0.43
Nodes (3): EditProfilePage(), useEditProfile(), FavouritesEditor()

### Community 64 - "Module 64"
Cohesion: 0.29
Nodes (7): Auth Flow, JWT Bearer Token Authentication, Raw SQL Only Convention, Resend SMTP, Sequelize 6, Supabase Auth, Supabase PostgreSQL

### Community 65 - "Module 65"
Cohesion: 0.29
Nodes (7): adminFetch, Supabase Client, ProtectedRoute, PublicOnlyRoute, PublicRoute, Route Tree & Guards, App Component

### Community 66 - "Module 66"
Cohesion: 0.33
Nodes (6): Accessibility: Reduced Motion Support, CSS Keyframe Animations, Design System: Color Tokens, Design System: Typography, App Component Styles, Global Index Styles

### Community 67 - "Module 67"
Cohesion: 0.47
Nodes (4): fmtDate(), PeoplePage(), PersonRow(), usePeoplePageData()

### Community 68 - "Module 68"
Cohesion: 0.40
Nodes (6): API Route Map, dedupIngest Pattern, POST /api/inject, POST /api/resolve, GET /api/search, TMDB Ingestion Architecture

### Community 69 - "Module 69"
Cohesion: 0.40
Nodes (3): initialState, mergeRowsById(), searchLocalSupabase()

### Community 70 - "Module 70"
Cohesion: 0.40
Nodes (3): ALL_ADMIN_TIERS, ALLOWED_TIERS, router

### Community 71 - "Module 71"
Cohesion: 0.50
Nodes (5): MarkdownEditor Component, RichTextEditor Component, Dual editing support for both Markdown and Rich Text, EditorContent component from @tiptap/react, useEditor hook from @tiptap/react

### Community 73 - "Module 73"
Cohesion: 0.40
Nodes (4): Server Reboot Notification via Email, Resend Email API Integration, Systemd Service Unit for Reboot Notifications, reboot-notify.sh script

### Community 74 - "Module 74"
Cohesion: 0.50
Nodes (3): applyFormat(), insertAt(), TOOLBAR

### Community 76 - "Module 76"
Cohesion: 0.50
Nodes (4): Cloudflare Pages, Cloudflare Proxy, DigitalOcean Droplet, GitHub Actions

## Knowledge Gaps
- **304 isolated node(s):** `inflight`, `router`, `router`, `ALLOWED_ACTIONS`, `router` (+299 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `supabase` connect `Auth & Middleware` to `Episode Page UI`, `Settings Page`, `Admin Dashboard`, `Follows & Social`, `Movie Ingestion`, `Module 19`, `Module 22`, `Module 23`, `Module 24`, `Module 25`, `Module 28`, `Module 29`, `Module 31`, `Module 35`, `Module 36`, `Module 48`, `Module 49`, `Module 50`, `Module 54`, `Module 55`, `Module 56`, `Module 61`, `Module 63`, `Module 69`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `tmdbRateLimitedFetch()` connect `Module 59` to `Script Infrastructure`, `TMDB TV Ingestion`, `Module 39`, `Module 42`, `Search & Discovery`, `Watchlist Management`, `Module 43`, `Module 44`, `Module 45`, `Module 46`, `Module 47`, `Module 18`, `Person Search`, `Module 52`, `Module 53`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `inflight`, `router`, `router` to the rest of the system?**
  _333 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Script Infrastructure` be split into smaller, more focused modules?**
  _Cohesion score 0.05289450484866295 - nodes in this community are weakly interconnected._
- **Should `Episode Page UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05063291139240506 - nodes in this community are weakly interconnected._
- **Should `Settings Page` be split into smaller, more focused modules?**
  _Cohesion score 0.0505175983436853 - nodes in this community are weakly interconnected._
- **Should `Admin Dashboard` be split into smaller, more focused modules?**
  _Cohesion score 0.05297532656023222 - nodes in this community are weakly interconnected._