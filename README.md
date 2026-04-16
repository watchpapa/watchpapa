# [watchpapa.tv](https://watchpapa.tv)

> Note: The description below reflects the current MVP scope.

## What is it?

Watchpapa.tv is a web application that lets you track the release dates of episodes of shows you're watching or waiting for, as well as movie releases.

## Scenario

You just found a series "A" you like and have finished all available episodes, but you know new episodes are still coming out, and you want to keep watching. You're also watching series "B" that comes out weekly.

Thanks to watchpapa.tv, you can follow those series and add release dates to your personal calendar (which can be synced with your Google/Apple calendar), and whenever a new episode comes out, you'll be reminded.

## MVP Tech Stack

- Frontend: Next.js + React on Cloudflare
- Backend/API: Cloudflare Workers
- Database: Supabase PostgreSQL
- Auth: Supabase Auth
- Email: Resend
- Scheduling: Cloudflare Cron Triggers
- Optional scaling buffer: Cloudflare Queues

## TMDB Ingestion Model (MVP)

1. Daily popular sync:
   - Fetch top 1000 popular movies and shows from TMDB.
   - If an item is missing in the database, ingest it.
   - Ingest related cast/people data with the title.
2. Daily freshness sync:
   - Build a list of TMDB IDs already present in local tables.
   - Re-fetch details for tracked IDs and update changed records in Supabase.
3. On-demand search fallback:
   - If a user search result is not found locally, fetch it from TMDB.
   - Save it to the database first, then return it to the user.

## Operational Notes

- Treat `tmdb_id` as the canonical external key for upserts.
- Design ingestion jobs to be idempotent.
- Respect TMDB limits (`~40 requests/second`) with bounded concurrency.
- Use a safer sustained target (`~25-30 requests/second`) for headroom.
- Add retry with exponential backoff and jitter for `429`/`5xx` responses.

## Image Delivery (MVP)

- Poster/backdrop images are loaded directly from TMDB CDN URLs.
- For MVP, binaries are not stored in project storage to reduce storage costs.
- Database records store TMDB image path metadata only (for example: `poster_path`, `backdrop_path`, `profile_path`).

## Additional Documentation

- Browse page components: `Documentation/components_browse_page.md`
- Implementation backlog: `TODO.md`
