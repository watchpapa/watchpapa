# TODO

Detailed MVP implementation backlog based on current `README.md`, approved architecture decisions, and browse-page component plan.

## Phase 0 - Project Setup

- [ ] Confirm monorepo layout (`frontend` for Next.js app, backend/worker code location).
- [ ] Initialize Next.js + React frontend configured for Cloudflare deployment.
- [ ] Add environment variable strategy for Supabase, TMDB, Resend, and app URLs.
- [ ] Define shared types for media records and API payloads.

## Phase 1 - Browse Page UI Foundation

- [ ] Create `BrowsePage` route and `LayoutShell`.
- [ ] Implement `TopNav` with sections: `Popular`, `Movies`, `Shows`, `People`.
- [ ] Implement reusable `ContentSection`.
- [ ] Implement reusable `MediaCard`.
- [ ] Implement reusable `PosterImage` with fallback.
- [ ] Implement skeleton/loading states for each row.
- [ ] Add responsive behavior for mobile horizontal scrolling.

## Phase 2 - Image Delivery (TMDB Direct)

- [ ] Add centralized TMDB image URL helper (size presets for card/detail contexts).
- [ ] Store only image path metadata in DB-driven payloads (`poster_path`, `backdrop_path`, `profile_path`).
- [ ] Ensure frontend renders CDN URLs from helper and never stores binaries.
- [ ] Add placeholder assets/logic for missing or invalid image paths.

## Phase 3 - Read APIs for Browse Sections

- [ ] Implement `GET /api/home/popular` (DB-first source).
- [ ] Implement `GET /api/home/movies`.
- [ ] Implement `GET /api/home/shows`.
- [ ] Implement `GET /api/home/people`.
- [ ] Add pagination/limit parameters for each section endpoint.
- [ ] Normalize API responses into shared `MediaListItem` shape.

## Phase 4 - Search + Ingest-on-Miss

- [ ] Build `SearchBar` with debounce and cancel-in-flight behavior.
- [ ] Implement `GET /api/search?q=...` local DB search for movies/shows/people.
- [ ] On local miss, call TMDB from backend, upsert entities, then return result.
- [ ] Ensure search never performs TMDB calls from browser client.
- [ ] Add UI states for loading/no-results/error.

## Phase 5 - Auth + Follow Flow

- [ ] Wire Supabase Auth session lifecycle on frontend.
- [ ] Implement follow endpoints for movies (`POST`/`DELETE`).
- [ ] Implement follow endpoints for shows (`POST`/`DELETE`).
- [ ] Persist follows to `user_followed_movies` and `user_followed_shows`.
- [ ] Add `FollowButton` optimistic updates with rollback on API failure.
- [ ] Gate follow interactions for unauthenticated users (prompt sign-in).

## Phase 6 - Daily Ingestion Jobs

- [ ] Implement daily popular sync job (top 1000 movies/shows).
- [ ] Include cast/person ingestion with each title ingest.
- [ ] Implement daily freshness sync job using existing local TMDB IDs.
- [ ] Upsert core entities idempotently by `tmdb_id`.
- [ ] Upsert relation tables (credits/genres) without duplication.

## Phase 7 - TMDB Rate-Limit Safety

- [ ] Implement bounded-concurrency TMDB client.
- [ ] Add token-bucket or leaky-bucket limiter.
- [ ] Keep sustained throughput near `25-30 req/s`.
- [ ] Add retry with exponential backoff + jitter for `429` and transient `5xx`.
- [ ] Queue or defer overflow workload instead of bursting past limit.

## Phase 8 - Reliability and Observability

- [ ] Log ingestion job start/end metrics (duration, counts, failures).
- [ ] Track endpoint error rates and search fallback hit rate.
- [ ] Add health and readiness checks for API/worker services.
- [ ] Document runbook steps for TMDB outage/rate-limit incidents.

## Phase 9 - Testing and Validation

- [ ] Unit test TMDB URL helper and throttling logic.
- [ ] Integration test search miss -> ingest -> response flow.
- [ ] Integration test follow/unfollow persistence and auth gating.
- [ ] Validate browse sections render from DB seed data.
- [ ] Verify no frontend TMDB key exposure and no direct client TMDB calls.

## Documentation

- [ ] Keep `README.md` MVP section aligned with implemented stack.
- [ ] Keep `Documentation/components_browse_page.md` aligned with shipped UI structure.
- [ ] Add API contract notes once endpoints are stable.
