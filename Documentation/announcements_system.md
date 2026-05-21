# Announcements / Updates System

> Added: May 2026

The announcements system powers the public `/updates` page where watchpapa staff (editors and admins) can publish news posts about new features, changes, and platform updates. Posts support rich text formatting. All writes are role-gated on the server; the public can only read live (non-archived) posts.

---

## Table of Contents

1. [Overview](#overview)
2. [Database](#database)
3. [Migrations](#migrations)
4. [Backend API](#backend-api)
5. [Access Control](#access-control)
6. [Frontend](#frontend)
7. [Admin Panel](#admin-panel)
8. [File Map](#file-map)

---

## Overview

| Concern | Decision |
|---|---|
| Storage | Supabase `public.announcements` table |
| Body format | HTML (output of TipTap WYSIWYG editor) |
| Soft delete | `archived = true` — post disappears from public feed but row is retained |
| Hard delete | Admin panel only (role 4); irreversible |
| Author visibility | Internal only — posts appear publicly as "watchpapa" |
| Authorship tracking | `author_id`, `archived_by`, `archived_at` stored in DB, visible in admin panel |

---

## Database

### Table: `public.announcements`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Primary key |
| `title` | `text` | NOT NULL | Post headline |
| `body` | `text` | NOT NULL | HTML body (TipTap output) |
| `image_url` | `text` | nullable | Optional banner image URL |
| `author_id` | `uuid` | NOT NULL, FK → `auth.users(id)` | Who created the post |
| `archived` | `boolean` | NOT NULL, default `false` | Soft-delete flag |
| `archived_by` | `uuid` | nullable, FK → `auth.users(id)` | Who archived it |
| `archived_at` | `timestamptz` | nullable | When it was archived |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last edit timestamp |

### Indexes

```sql
CREATE INDEX announcements_created_at_idx ON public.announcements(created_at DESC);
CREATE INDEX announcements_archived_idx   ON public.announcements(archived, created_at DESC);
```

### RLS

Row Level Security is **enabled** on the table. There are no user-facing RLS policies — all reads and writes go through the Express backend using the service-role key, which bypasses RLS entirely. This means RLS acts as a safety net preventing direct client-side Supabase access.

---

## Migrations

| File | Description |
|---|---|
| `Backend/src/db/migrations/014_announcements.sql` | Creates the `announcements` table with indexes and RLS |
| `Backend/src/db/migrations/015_announcements_archive_tracking.sql` | Adds `archived_by` and `archived_at` columns |

Run both in order in the Supabase SQL editor if setting up from scratch.

---

## Backend API

Base path: `/api/announcements` (public router) and `/api/admin/announcements` (admin router).

### Public endpoints

#### `GET /api/announcements`

Returns all live (non-archived) posts, newest first. Public — no auth required.

**Response**
```json
{
  "announcements": [
    {
      "id": "uuid",
      "title": "string",
      "body": "<p>HTML string</p>",
      "image_url": "https://... or null",
      "created_at": "2026-05-01T12:00:00Z"
    }
  ]
}
```

Note: `author_id`, `archived_by`, `archived_at` are **never returned** by this endpoint.

---

#### `POST /api/announcements`

Creates a new post. Requires auth + role 3 or 4.

**Request body**
```json
{
  "title": "string (max 300 chars)",
  "body": "<p>HTML string (max 100,000 chars)</p>",
  "image_url": "https://... (optional)"
}
```

**Response** — `201 Created`
```json
{ "announcement": { "id": "...", "title": "...", "body": "...", "image_url": null, "created_at": "..." } }
```

---

#### `PATCH /api/announcements/:id`

Updates an existing post. Requires auth + role 3 or 4. **Cannot edit archived posts** (`.eq("archived", false)` filter applied — request silently fails to match if the post is archived).

**Request body** — same shape as POST.

**Response** — `200 OK`, returns updated post fields.

---

#### `PATCH /api/announcements/:id/archive`

Soft-deletes a post. Requires auth + role 3 or 4. Sets `archived = true`, records `archived_by` (requester's user ID) and `archived_at`.

**Response** — `200 OK`
```json
{ "ok": true }
```

---

### Admin endpoints

All admin endpoints are mounted under `/api/admin/announcements` and require **auth + role 4** enforced at the Express mount level in `app.js`. Individual route handlers do not need to re-check the role.

#### `GET /api/admin/announcements`

Returns all posts including archived, with full tracking fields.

**Response fields include:** `id`, `title`, `body`, `image_url`, `author_id`, `archived`, `archived_by`, `archived_at`, `created_at`, `updated_at`.

---

#### `PATCH /api/admin/announcements/:id/restore`

Restores an archived post. Clears `archived_by` and `archived_at`, sets `archived = false`.

**Response** — `200 OK` `{ "ok": true }`

---

#### `DELETE /api/admin/announcements/:id`

Permanently deletes a post. **Irreversible.** Admin (role 4) only. The admin panel UI shows a confirmation dialog before calling this endpoint.

**Response** — `200 OK` `{ "ok": true }`

---

## Access Control

### Role definitions (from `profile.role`)

| Role value | Name | Permissions |
|---|---|---|
| `0` | User | Read public announcements only |
| `3` | Moderator | Create, edit, archive |
| `4` | Admin | Create, edit, archive + restore, hard delete |

### Enforcement layers

**Server-side (authoritative):**

All role checks are performed server-side against the `profile` table using the Supabase **service-role key** — they cannot be bypassed by forging a JWT claim.

| Middleware | File | Used for |
|---|---|---|
| `requireAuth` | `Backend/src/middleware/requireAuth.js` | Validates the Bearer token via `supabase.auth.getUser()`, attaches `req.user` |
| `requireEditor` | `Backend/src/middleware/requireEditor.js` | Checks `profile.role` is `3` or `4` |
| `requireAdmin` | `Backend/src/middleware/requireAdmin.js` | Checks `profile.role` is `4` |

**Middleware chain per route:**

```
POST   /api/announcements            → globalLimiter → mutationLimiter → requireAuth → requireEditor → handler
PATCH  /api/announcements/:id        → globalLimiter → mutationLimiter → requireAuth → requireEditor → handler
PATCH  /api/announcements/:id/archive→ globalLimiter → mutationLimiter → requireAuth → requireEditor → handler
GET    /api/announcements            → globalLimiter → handler (public)

GET    /api/admin/announcements      → globalLimiter → adminLimiter → requireAuth → requireAdmin → handler
PATCH  /api/admin/.../:id/restore    → globalLimiter → adminLimiter → requireAuth → requireAdmin → handler
DELETE /api/admin/.../:id            → globalLimiter → adminLimiter → requireAuth → requireAdmin → handler
```

Note: `mutationLimiter` is wrapped with `mutationOnly()` so it skips GET requests. The public GET runs under the global limiter only (120 req/min/IP).

**Frontend (UI only — not security):**

The `UpdatesPage` fetches `profile.role` from Supabase to conditionally show the Edit / Archive / New post buttons. This is display logic only — the backend is the authoritative check.

### Security properties

- `author_id`, `archived_by`, `archived_at` are **never exposed** via the public GET endpoint
- The edit endpoint (`PATCH /:id`) silently ignores requests targeting archived posts via `.eq("archived", false)` — there is no way to edit an archived post via the API
- Input validation: title ≤ 300 chars, body ≤ 100,000 chars on both create and edit
- HTML body is created only by trusted roles (3/4); `dangerouslySetInnerHTML` is used for rendering on the public page — this is acceptable given the trust level of the authors
- Hard delete requires a browser `window.confirm()` in the admin UI and targets role 4 only at the API level

---

## Frontend

### Public Updates page — `/updates`

**File:** `Frontend/src/pages/app/UpdatesPage.jsx`

- Accessible to all users (logged in or not)
- Fetches posts from `GET /api/announcements` on mount
- Renders each post as a card: optional banner image, "watchpapa — date" byline, title, formatted body
- Body is rendered via `dangerouslySetInnerHTML` using styles from `RichTextEditor.css` (`.prose-content` class)
- Role 3/4 users additionally see **Edit** and **Archive** action buttons on each card
- "+ New post" button opens the `PostModal` in create mode
- Edit button opens `PostModal` in edit mode, pre-filled with the post's current content

### PostModal (create + edit)

`PostModal` is a unified modal for both creating and editing. It detects mode by the presence of the `post` prop:

- `post = null` → create mode → calls `createAnnouncement()` (POST)
- `post = { id, title, body, ... }` → edit mode → calls `updateAnnouncement(id, ...)` (PATCH)

The modal contains a **title input**, the **RichTextEditor**, and an **image URL input**.

### RichTextEditor

**Files:**
- `Frontend/src/components/ui/RichTextEditor.jsx`
- `Frontend/src/components/ui/RichTextEditor.css`

Built on [TipTap](https://tiptap.dev/) with the following extensions:

| Extension | Package | Keyboard shortcut |
|---|---|---|
| Bold | `@tiptap/starter-kit` | `⌘B` |
| Italic | `@tiptap/starter-kit` | `⌘I` |
| Underline | `@tiptap/extension-underline` | `⌘U` |
| Strike | `@tiptap/starter-kit` | — |
| Heading (H1/H2/H3) | `@tiptap/starter-kit` | — |
| Bullet list | `@tiptap/starter-kit` | `⌘⇧8` |
| Ordered list | `@tiptap/starter-kit` | `⌘⇧7` |
| Blockquote | `@tiptap/starter-kit` | — |
| Inline code | `@tiptap/starter-kit` | — |
| Code block | `@tiptap/starter-kit` | — |
| Link | `@tiptap/extension-link` | — (toolbar prompt) |
| Horizontal rule | `@tiptap/starter-kit` | — |
| Undo / Redo | `@tiptap/starter-kit` | `⌘Z` / `⌘⇧Z` |
| Placeholder | `@tiptap/extension-placeholder` | — |

Output format: **HTML string** stored in the `body` column.

### Data hooks

| Hook | File | Purpose |
|---|---|---|
| `useAnnouncements` | `Frontend/src/features/announcements/hooks/useAnnouncements.js` | Fetch, create, update, archive — used by `UpdatesPage` |
| `useAdminAnnouncements` | `Frontend/src/features/admin/hooks/useAdminAnnouncements.js` | Fetch all (incl. archived), restore, delete — used by `AnnouncementsPage` |

### Report Bug floating button

**File:** `Frontend/src/components/ui/ReportBugButton.jsx`

A fixed floating button in the bottom-right corner of every page. Opens the Google Form bug report at `https://forms.gle/VeLj9nSa2zNfxfCYA` in a new tab. Rendered globally in `App.jsx` alongside `CookieConsentBanner`.

---

## Admin Panel

### Announcements page — `/admin/announcements`

**File:** `Frontend/src/pages/admin/AnnouncementsPage.jsx`

Accessible to role 4 (admin) only via `AdminRoute`. Features:

- **Filter tabs:** Live / Archived / All
- **Per-post info shown:** title, created_at, updated_at (if differs), `author_id` (UUID), `archived_by` (UUID, if archived), `archived_at` timestamp, image_url (if set), body preview (2-line clamp)
- **Restore button** — shown only on archived posts; calls `PATCH /api/admin/announcements/:id/restore`
- **Delete button** — shown on all posts; triggers `window.confirm()` then calls `DELETE /api/admin/announcements/:id`

### Admin panel shortcut

Users with `profile.role = 4` see an ★ **Admin panel** link at the top of the `ProfileMenu` dropdown. The role is fetched alongside tier and early-adopter status when the menu is opened.

### Admin nav entry

`AdminPage.jsx` includes an **Announcements** link under the **Content** section in the sidebar/tab strip.

---

## File Map

```
Backend/
  src/
    middleware/
      requireEditor.js          Role 3 or 4 check (server-side, service-role key)
    routes/
      announcements.js          Public GET + editor-only POST, PATCH, PATCH archive
      admin/
        announcements.js        Admin GET, PATCH restore, DELETE
    db/
      migrations/
        014_announcements.sql           Create table
        015_announcements_archive_tracking.sql  Add archived_by, archived_at

app.js                          Route mounting + rate limiter wiring

Frontend/
  src/
    components/
      layout/
        Footer.jsx              "Updates" link added
        ProfileMenu.jsx         Admin panel shortcut for role 4
      ui/
        ReportBugButton.jsx     Floating bug report button (Google Forms)
        RichTextEditor.jsx      TipTap WYSIWYG editor component
        RichTextEditor.css      Editor + prose-content display styles
    features/
      announcements/
        hooks/
          useAnnouncements.js   fetch, create, update, archive
      admin/
        hooks/
          useAdminAnnouncements.js  fetch all, restore, delete
    pages/
      app/
        UpdatesPage.jsx         Public updates feed + PostModal (create/edit)
      admin/
        AnnouncementsPage.jsx   Admin management view (restore, delete)
        AdminPage.jsx           Nav entry added under "Content"
    App.jsx                     /updates route + /admin/announcements subroute
```
