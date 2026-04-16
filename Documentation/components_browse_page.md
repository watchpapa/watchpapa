# Browse Page Components

This document breaks down the MVP browse page shown in the conceptual mockup and maps each UI block to responsibilities, data inputs, and backend dependencies.

## Page Goal

The browse page helps users quickly discover popular media and follow titles so release dates can be tracked and surfaced in their calendar flow.

## Component Tree (MVP)

- `BrowsePage`
  - `LayoutShell`
  - `TopNav`
  - `ReleaseCalendarCTA`
  - `SearchBar`
  - `BrowseSections`
    - `ContentSection` (`Popular`)
    - `ContentSection` (`Movies`)
    - `ContentSection` (`Shows`)
    - `ContentSection` (`People`)
      - `MediaCard` (repeated)
        - `PosterImage`
        - `MediaMeta`
        - `FollowButton`

## Components

## `BrowsePage`

- **Purpose:** Composition root for the full browse view.
- **Responsibilities:**
  - Fetch and hydrate all homepage section data.
  - Provide loading and error states for full page.
  - Pass user/auth context to follow-aware children.

## `LayoutShell`

- **Purpose:** Consistent page frame and visual style.
- **Responsibilities:**
  - Constrain content width and vertical rhythm.
  - Apply dark gradient background and spacing tokens.
  - Support responsive behavior across desktop/tablet/mobile.

## `TopNav`

- **Purpose:** Primary navigation and user entry point.
- **Responsibilities:**
  - Display brand (`watchpapa`) and top-level browse tabs.
  - Render user avatar/menu area.
  - Provide active-section affordance.

## `ReleaseCalendarCTA`

- **Purpose:** Shortcut to release calendar feature.
- **Responsibilities:**
  - Render clear CTA button/link.
  - Show authenticated behavior (enabled) vs guest behavior (redirect to sign-in).

## `SearchBar`

- **Purpose:** Fast title/person lookup from browse page.
- **Responsibilities:**
  - Debounce user query input.
  - Trigger search API call and show progress feedback.
  - Render empty/miss states.
  - Use backend local-first search with TMDB ingest-on-miss fallback.

## `BrowseSections`

- **Purpose:** Container for all horizontally scrollable rows.
- **Responsibilities:**
  - Render sections in product order (`Popular`, `Movies`, `Shows`, `People`).
  - Keep section spacing and heading style consistent.
  - Handle per-section skeletons and retry affordance on failure.

## `ContentSection`

- **Purpose:** Reusable row wrapper for one media category.
- **Props (MVP):**
  - `title: string`
  - `items: MediaListItem[]`
  - `isLoading?: boolean`
  - `onRetry?: () => void`
- **Responsibilities:**
  - Render heading and horizontal scroller.
  - Render `MediaCard` list.
  - Handle empty state text when `items` is empty.

## `MediaCard`

- **Purpose:** Single media/person preview tile.
- **Props (MVP):**
  - `id: string | number`
  - `type: "movie" | "show" | "person"`
  - `title: string`
  - `posterPath?: string`
  - `subtitle?: string`
  - `isFollowed?: boolean`
- **Responsibilities:**
  - Show poster and primary metadata.
  - Build image URL from TMDB image path (no local poster storage in MVP).
  - Render follow toggle for movies/shows.
  - Route to detail view on click.

## `PosterImage`

- **Purpose:** TMDB-backed image rendering with graceful fallback.
- **Responsibilities:**
  - Convert `poster_path`/`profile_path` to full CDN URL via centralized helper.
  - Provide fallback placeholder when image path is missing.
  - Keep consistent aspect ratio for row cards.

## `FollowButton`

- **Purpose:** Persist user follow state per item.
- **Responsibilities:**
  - Show `Follow` / `Following`.
  - Optimistically update state and rollback on failure.
  - Gate behavior by auth session.

## Data Contracts (MVP)

- `MediaListItem`
  - `id`
  - `tmdb_id`
  - `type` (`movie` | `show` | `person`)
  - `title` (or normalized display name)
  - `poster_path` (or `profile_path` for people)
  - `release_date` or `first_air_date` when available
  - `is_followed` (movies/shows only, user-scoped)

## API Dependencies (MVP)

- `GET /api/home/popular`
- `GET /api/home/movies`
- `GET /api/home/shows`
- `GET /api/home/people`
- `GET /api/search?q=...`
- `POST /api/follow/movie`
- `DELETE /api/follow/movie`
- `POST /api/follow/show`
- `DELETE /api/follow/show`

## Non-Functional Constraints

- TMDB calls are server-side only.
- TMDB limit is approximately `40 req/s`; target sustained usage is `25-30 req/s`.
- UI must not directly call TMDB APIs from browser.
- Poster/backdrop binaries are not stored locally for MVP; only path metadata is stored.
