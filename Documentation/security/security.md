# Security Information 🛡️

> Rewritten 13 Oct 2026 for the Cloudflare Worker architecture. Replaces the May 2026 version, which described an Express API and ingestion scripts.

## Table of contents

- [Threat Model](#threat-model)
- [Legend](#legend)
- [Threat boundaries & STRIDE](#threat-boundaries-marked-as-purpleblue-ish-dotted-lines)
- [Other threats](#other-threats)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Validation](#validation)
- [Encryption](#encryption)
- [Signing](#signing)
- [Key management](#key-management)
- [Best practices followed](#best-practices-followed)
- [Future considerations](#future-considerations)

## Threat Model

> ⚠️ The diagram below is the **May 2026** version (Express API server `P2`, ingestion scripts `P3`). It has not been redrawn; the entity, flow and threat tables below describe the current system and are the source of truth. Redraw the diagram from them before reusing it.

![watchpapa.tv threat model (May 2026, outdated)](<../../public/readme assets/watchpapa.tv-Threat Model-2:05:2026.png>)

### 📋 Legend

#### 👥 Entities (rectangles)

| Label | Description |
|-------|-------------|
| `[E1] Anonymous User` | Unauthenticated browser visitor (browse, search, shared links) |
| `[E2] Authenticated User` | Logged-in user (follow, rate, watchlists, import, …) |
| `[E3] TMDB API` | External third-party metadata source, read-only; also serves poster images (`image.tmdb.org`) straight to browsers |
| `[E4] Supabase Auth` | External managed identity provider (issues JWTs, publishes the JWKS) |
| `[E5] Resend SMTP` | External email delivery service (OTP, verification emails) |
| `[E6] Have I Been Pwned` | External k-anonymity range API for the breached-password check |
| `[E7] Social / chat crawlers` | Facebook, X, Slack, Discord, … — fetch pages to build link previews, run no JS |

#### ⚙️ Processes (rounded rectangles)

| Label | Description |
|-------|-------------|
| `[P1] React Frontend (SPA)` | Browser-side UI — Vite/React 19, served by Cloudflare Pages |
| `[P2] Worker API` | Cloudflare Worker (Hono): live TMDB reads with edge caching, user-data endpoints, admin, background-import cron |
| `[P3] Pages Function` | `Frontend/functions/_middleware.js`: real 404s and link-preview/JSON-LD injection in front of the SPA |
| `[P4] Supabase RLS Engine` | Supabase-managed policy enforcement layer |
| `[P5] Backup job` | GitHub Actions workflow: `pg_dump` → gzip → `age` encryption → R2 |

#### 💾 Data stores (cylinders)

| Label | Description | Sensitivity |
|-------|-------------|-------------|
| `[D1] PostgreSQL DB (Supabase)` | User data only: profiles, ratings, watch log, watchlists, follows, social graph, subscriptions, audit events, import jobs (content tables are empty) | High |
| `[D2] auth.users (Supabase)` | User credentials (bcrypt hashes), email, OAuth identities | Critical |
| `[D3] JWT in localStorage / sessionStorage` | Session token persisted in browser storage (consent-aware) | High |
| `[D4] Worker logs / `audit_events`` | Cloudflare Workers observability logs; audit rows (user ID, email, IP, allowlisted body) | Medium |
| `[D5] Cloudflare edge cache` | Cached TMDB responses (public data only; user-specific routes are never cached) | Low |
| `[D6] R2 backup bucket` | Encrypted nightly dumps, 30-day lifecycle | High (ciphertext) |

#### 🔀 Data flows

| Label | From | To | Data | Protocol |
|-------|------|----|------|----------|
| `[F1a]` / `[F1b]` | E1 / E2 | P1 | UI interaction (anonymous / authenticated) | HTTPS |
| `[F2]` | P1 | E4 | Email + password / OAuth token; password hash prefix goes to E6 first | HTTPS |
| `[F3]` | E4 | P1 | JWT access token | HTTPS |
| `[F4]` | E4 | D2 | Credential/user record create + lookup | Internal (Supabase) |
| `[F5]` / `[F6]` | E4 → E5 → E2 | | OTP / verification email | SMTP |
| `[F7]` | P1 | P2 | Content, search, sitemap, image-proxy requests (no auth, locale as query params) | HTTPS + CORS |
| `[F8]` | P1 | P2 | User-data / admin / import requests + JWT Bearer | HTTPS + CORS |
| `[F9]` | P2 | E4 | JWKS fetch (public keys, cached) — **no per-request call** | HTTPS |
| `[F10]` | P2 | D1 | Parameterized SQL via Hyperdrive (pooler role, bypasses RLS) | TLS |
| `[F11]` | P2 | E3 | TMDB v3 fetches (API key in query string), edge-cached | HTTPS |
| `[F12]` | P1 | E3 | Poster/backdrop image loads straight from the TMDB image CDN (leaks viewer IP/UA to TMDB) | HTTPS |
| `[F13]` | P1 | D1 | Direct supabase-js reads/writes on user tables (RLS-protected) | HTTPS |
| `[F14]` | P4 | D1 | Policy-filtered reads/writes | Internal |
| `[F15]` | P2 / D1 triggers | D4 | Audit rows (`source = worker` / `db`) | TLS |
| `[F16]` | P1 | D3 | JWT write/read | Browser API |
| `[F17]` | P1 | E6 | First 5 hex chars of SHA-1(password) + client IP | HTTPS |
| `[F18]` | E7 | P3 | Page request from a crawler | HTTPS |
| `[F19]` | P3 | P2 | `GET /api/meta?path=` for the preview payload | HTTPS |
| `[F20]` | P2 | D5 | Edge cache lookup/set for TMDB responses | Cloudflare |
| `[F21]` | P5 | D1 | Full dump via the session pooler | TLS |
| `[F22]` | P5 | D6 | `age`-encrypted dump upload | HTTPS |

---

### 🔲 Threat boundaries (dotted lines)

#### 🎯 STRIDE threats (T#)

---

**T1** (application) — 🎭 Spoofing — JWT replay

- ✅ **Prevention:** `requireAuth` verifies the Bearer JWT on every protected Worker request, locally against Supabase's JWKS (signature, issuer, `authenticated` audience, expiry). Roles (`editor`, `admin`) are re-read from `public.profile` on each request, never taken from the token.
- ⚠️ **Known gap:** No server-side revocation — a stolen token is valid until natural expiry; accepted trade-off.

---

**T2** (application) — 🔧 Tampering — malformed request bodies / query params

- ✅ **Prevention:** Handlers validate their own input (announcement lengths, import payload shape and caps, tier-reward `validateIssueBody`, `readLocale()` allow-lists, NSFW keyword ids validated before reaching TMDB, positive-int checks on ids/pages); all SQL is parameterized.
- ⚠️ **Known gap:** No shared schema layer — each route validates by hand, so a new route can forget to.

---

**T3** (application) — 📜 Repudiation — user denies a mutation

- ✅ **Prevention:** The `auditLog()` middleware (default: records no body, explicit allowlist required) on every Worker mutation, plus DB triggers on all user-data tables (migration 044), write `audit_events` with user, target, IP, status and source.
- ⚠️ **Known gap:** None known; 90-day retention is deliberate.

---

**T4** (application) — 👁️ Information disclosure — stack traces / upstream errors in responses

- ✅ **Prevention:** The global error handler returns `{ error: "Internal server error" }` and logs details server-side; the TMDB client redacts the API key from upstream error text.
- ⚠️ **Known gap:** A TMDB failure surfaces as a 502 whose message includes the first 200 characters of TMDB's error body.

---

**T5** (application) — ⛔ Denial of service — request flooding / subrequest exhaustion

- ✅ **Prevention:** `RL_GLOBAL` (240/min per IP) on every route and `RL_MUTATION` (30/min per user) on writes, both Workers Rate Limiting bindings (shared across instances, unlike the old in-process limiters); edge caching absorbs repeat content requests; fan-out endpoints are capped by wrangler vars to stay under the Free-plan 50-subrequest limit; the import queue advances at most 1 job × 2 chunks per cron tick.
- ⚠️ **Known gap:** Limits are per Cloudflare location; a distributed flood is handled by Cloudflare's network protection, not by our code. The limiter fails open if the binding errors.

---

**T6** (application) — 🔑 Elevation of privilege — accessing another user's data

- ✅ **Prevention:** RLS (`profile_id = auth.uid()`) on every user table for browser access; every Worker user-data query is explicitly scoped to the authenticated user id.
- ⚠️ **Known gap:** The Worker's pooler role bypasses RLS, so a missing `WHERE profile_id = …` in a new Worker query would not be caught by the database. Covered only by review.

---

**T7** (application) — 🎭 Spoofing — forging another user's profile_id

- ✅ **Prevention:** RLS `profile_id = auth.uid()`; the anon key cannot mint another user's JWT; SECURITY DEFINER RPCs derive the caller from `auth.uid()`.
- ⚠️ **Known gap:** Some SECURITY DEFINER RPCs take a `p_profile_id` argument and are executable by `anon`/`authenticated` (e.g. `get_limit_status`, `get_observe_counts`); whether each one enforces its own viewer/ownership check inside the function has not been audited since migration 042.

---

**T8** (application) — 🔑 Elevation of privilege — RLS misconfiguration

- ✅ **Prevention:** RLS is enabled on every `public` table (verified against the live database in the 2026-09-05 audit, migration 042); `tests/rls_tests/` assert isolation; trigger functions have `EXECUTE` revoked from `anon`/`authenticated`.
- ⚠️ **Known gap:** A new table added without RLS would be readable with the anon key — new tables must be added to the RLS tests. One existing test (`User B cannot SELECT User A profile`) is stale because profiles are now intentionally readable by authenticated users.

---

**T9** (application) — 👁️ Information disclosure — anon key in frontend bundle

- ✅ **Prevention:** Only the publishable/anon key ships to the browser; RLS is the fence. The Worker holds no Supabase service-role key.
- ⚠️ **Known gap:** As T8.

---

**T10** (application) — 🔧 Tampering — malicious TMDB response data

- ✅ **Prevention:** Nothing from TMDB is stored. `normalize.js` reshapes every payload to known fields; React escapes rendered text.
- ⚠️ **Known gap:** TMDB titles/overviews are community-editable, and the Pages Function injects JSON-LD with `JSON.stringify` (which does not escape `<`) inside a `<script>` tag using `HTMLRewriter` `{ html: true }`. A `</script>` in a TMDB field could break out of the tag on `watchpapa.tv`. **Not yet fixed** — escape `<` as `\u003c` in `Frontend/functions/_middleware.js`.

---

**T11** (application) — 👁️ Information disclosure — TMDB API key leak

- ✅ **Prevention:** Key is a Worker secret (`wrangler secret put`), never in the frontend bundle; error text redacts it; Cloudflare's cache key ignores it.
- ⚠️ **Known gap:** The key travels as a query parameter (`api_key=`) on outbound requests, so it would appear in any URL logged by an intermediary; TMDB v3 also supports a Bearer token, which would avoid this.

---

**T12** (application) — ⛔ Denial of service — TMDB rate limit exceeded

- ✅ **Prevention:** Edge caching (TTL 6 h–7 d per endpoint) keeps most requests off TMDB; the client retries 429/5xx up to twice, honouring `Retry-After` (capped at 5 s).
- ⚠️ **Known gap:** A cold-cache burst can still hit TMDB's per-IP limit (roughly 40–60 req/s) from Cloudflare's shared egress.

---

**T13** (network) — 🎭 Spoofing — TMDB or Supabase response spoofed via MITM

- ✅ **Prevention:** HTTPS to TMDB; TLS to Supabase through Hyperdrive (`sslmode=require`).
- ⚠️ **Known gap:** A compromised CA or DNS poisoning would still succeed; infrastructure-level fix.

---

**T14** (application) — 👁️ Information disclosure — audit log exposure

- ✅ **Prevention:** Audit bodies are limited to allowlisted fields; `audit_events` has RLS with no client policies and is read only through admin routes; the auth-events tab is read-only.
- ⚠️ **Known gap:** User id, email and IP are necessarily present in every entry; access control is the Supabase dashboard and admin role.

---

**T15** (application) — 📜 Repudiation — audit log tampering

- ✅ **Prevention:** No client INSERT/UPDATE/DELETE policy; writes come from the Worker and `SECURITY DEFINER` triggers only.
- ⚠️ **Known gap:** The Worker's pooler role (and anyone with database access) can still modify rows; the 90-day `pg_cron` cleanup deletes them by design.

---

**T16** (application) — 👁️ Information disclosure — secrets in error responses or the bundle

- ✅ **Prevention:** Secrets only as Worker secrets, GitHub Actions secrets or gitignored local files; responses never echo environment values; no debug endpoints.
- ⚠️ **Known gap:** None in the codebase; dashboard access is the remaining exposure.

---

**T17** (application) — 👁️ Information disclosure — XSS reads the JWT

- ✅ **Prevention:** Hono `secureHeaders()` on API responses; CORS allow-list; React escaping; cookie-consent-aware storage (localStorage only after the user accepts, otherwise sessionStorage; `Frontend/src/lib/supabase.js`, `cookieConsent.js`).
- ⚠️ **Known gap:** localStorage is JS-readable if XSS occurs while the user accepted cookies; no explicit Content-Security-Policy on the Pages site (no `_headers` file); the `/updates` page renders staff-authored HTML with `dangerouslySetInnerHTML`; T10's JSON-LD gap is a possible XSS vector.

---

**T18** (application) — 📜 Repudiation — direct supabase-js writes bypass the Worker audit middleware

- ✅ **Prevention:** DB triggers (migration 044 `audit_row_change()`, `audit_profile_change()`) record those writes with `auth.uid()` as the actor.
- ⚠️ **Known gap:** Bulk writes can suppress row triggers with `SET LOCAL watchpapa.audit_skip`; the Worker's import path does so and logs one summary row instead.

---

**T19** (application) — 👁️ Information disclosure — backups

- ✅ **Prevention:** Nightly dump is piped (never written to disk) through `age` public-key encryption on the runner; only ciphertext reaches the private R2 bucket; the decryption key is offline; 30-day lifecycle; tested restore drill.
- ⚠️ **Known gap:** Anyone holding both the `age` key and R2 access can read everything; erased users stay in backups for up to 30 days.

---

**T20** (application) — 👁️ Information disclosure — third-party calls from the browser

- ✅ **Prevention:** HIBP uses k-anonymity (5-char prefix only); share-card images go through the Worker proxy.
- ⚠️ **Known gap:** Poster images load directly from `image.tmdb.org` and the HIBP call exposes the client IP to those services; disclosed in the Privacy Policy and the processing records.

---

### ⚡ Other threats

- 📱 **Device theft** — device that has stored `.env` / `worker/.dev.vars` keys and other credentials
- 🌐 **Mono-culture related risks** — project relies on availability of: Supabase, TMDB, Resend, Cloudflare (Pages, Workers, Hyperdrive, R2), GitHub Actions
- 🔓 **Lost, stolen, or unlocked device with an active session** — browser storage may still hold a valid JWT; usable until natural expiry with no server-side revocation (see T1, T17); complements developer `.env` exposure on theft
- 🔍 **Public content endpoints overload** — `/api/content*`, `/api/search`, `/api/image-proxy` are unauthenticated; mitigated by the `RL_GLOBAL` rate limit (240/min per IP) and Cloudflare's edge cache, which absorbs repeat requests; every uncached request spends Worker subrequests and TMDB quota
- 🧮 **Free-plan ceilings as a DoS surface** — a Worker invocation has a 50-subrequest cap, fan-out endpoints are bounded by wrangler vars (`BATCH_MAX`, `RECOMMENDATIONS_*`, …); a request that exceeds them fails rather than running unbounded
- ✉️ **Authentication email channel (OTP / recovery via Supabase → Resend)** — email sits outside HTTPS-only APIs; phishing, spoofed mails, or a compromised inbox can regain access; flows align with F5/F6 rather than Bearer-only paths
- 🌍 **`ALLOWED_ORIGINS` / CORS in production** — the Worker's `ALLOWED_ORIGINS` var must match every deployed SPA origin exactly (currently `https://watchpapa.tv` plus two localhost origins); stale or incorrect values strand legitimate users
- 🗄️ **Backups** — nightly dumps contain every user's data; they are `age`-encrypted before leaving the GitHub Actions runner and the private key is kept offline, but anyone with the key and the R2 objects can read everything. R2 keys are separate from the decryption key by design.
- 🖼️ **Third-party image CDN** — posters load directly from `image.tmdb.org`, so TMDB sees viewers' IPs; share cards go through the Worker's `/api/image-proxy` only because canvas needs CORS

---

### 🔐 Authentication

- 🔑 Supabase Auth (no custom credential DB).
- 💾 Browser: anon key, persisted session, auto-refresh; tokens in localStorage (cookies accepted) or sessionStorage (`supabase.js` + cookie consent).
- 🚪 Sign-in: email/password, Google, GitHub; signup OTP + forgot-password flows via Supabase APIs.
- 🔄 App load: `getSession` → `getUser`; bad session cleared; `onAuthStateChange` updates UI; `ProtectedRoute` + username setup gate.
- 🛂 API: user-data routes (`/api/import/*`, `/api/rewards/claim`, `/api/referral/*`, editor-level `/api/announcements` writes, `/api/admin/*`) need a `Bearer` JWT; `requireAuth` (`worker/src/auth.js`) verifies it **locally** against Supabase's JWKS (`jose`, ES256, issuer + `authenticated` audience) and sets `c.get("user")`. Content, search, meta and sitemap routes are public.
- 🔐 Passwords are screened against known breaches client-side (see Encryption).
- ⏱️ No server-side revocation (see T1); JWT validity = Supabase token lifetime.

---

### 🏷️ Authorization

- 🔒 User-scoped data in Supabase Postgres uses **RLS** on every `public` table (ratings, watch log, watchlists, follows, favourites, profile, notifications, tier rewards, import jobs, …; policies tie rows to `auth.uid()` — see T6–T9). The 2026-09-05 audit (migration 042) re-verified every table against the live `pg_policies`.
- 👑 **Roles** (`profile.role`: 0 user, 3 editor, 4 admin) are checked **server-side against the database** (`requireEditor` / `requireAdmin`), never read from the JWT, and users cannot write `role` (column REVOKE + trigger, migration 010). Tier-gated features are enforced by DB triggers (follow limits, watchlist limits, avatar upload, streaming-provider selection) and `get_effective_tier()`, not just UI.
- 📋 **`audit_events`**: RLS on, **no** client policies; written by the Worker's `auditLog` middleware and by DB triggers (migration 044), read only through admin routes. 90-day retention (`pg_cron`).
- ✔️ The Worker connects to Postgres through Hyperdrive as a pooler role that **bypasses RLS**, so each Worker route must scope its own queries by the authenticated user id; for everything the browser does directly through supabase-js, RLS is the fence.

---

### ✔️ Validation

- 📦 **Worker inputs**: route handlers validate their own bodies (e.g. announcements title ≤ 300 / body ≤ 100,000; import payload shape and caps; tier-reward `validateIssueBody`; `readLocale()` allow-lists `lang`/`region`/`providers` and `nsfw.js` validates keyword ids before they reach TMDB).
- 🔎 **`/api/search`**: query validated and passed to TMDB `/search/multi`.
- 🎬 **TMDB data**: never stored; `normalize.js` reshapes every TMDB payload to the fields the UI reads, so unexpected upstream fields are not forwarded.
- 🧱 **Output**: React escapes by default; `/updates` posts are staff-authored HTML rendered with `dangerouslySetInnerHTML` (trusted authors only); the Pages Function sets `<head>` text via `HTMLRewriter` `setAttribute`/`setInnerContent` (escaped by the API), **but** it injects JSON-LD as `<script type="application/ld+json">${JSON.stringify(obj)}</script>` with `{ html: true }` and `JSON.stringify` does not escape `<`. TMDB titles/overviews are community-editable, so a value containing `</script>` would break out of the tag. **Known gap, not yet fixed** — escape `<` as `\u003c` in `Frontend/functions/_middleware.js` (and in `PageHead.jsx` if it serialises the same way).
- 🖥️ **UI**: username rules, password policy, age checks, positive integer IDs before follow toggles (`validate.js`, hooks).

---

### 🔒 Encryption

- 🌐 **Transport**: HTTPS (**TLS**) for browser ↔ Cloudflare, browser ↔ Supabase, Worker ↔ TMDB.
- 🗄️ **Postgres**: the Worker reaches Supabase through **Hyperdrive** (TLS to the session pooler, `sslmode=require`, caching disabled so per-user data is never shared); RLS tests and the backup job use the pooler URL with SSL.
- 🔐 **Supabase Auth — passwords at rest**: Not encrypted for later decryption — they are stored as **one-way hashes**. New passwords use **bcrypt** (salt per hash); only that hash goes in Postgres (`auth.users.encrypted_password` is a **historical misnomer** — it holds a bcrypt hash, not reversible ciphertext). Migrated accounts may retain other hash formats Supabase recognizes (e.g. Argon2). Official detail: [Supabase password security](https://supabase.com/docs/guides/auth/password-security).
- 🛡️ **Breached-password check**: done **client-side** in the app (`Frontend/src/lib/pwned.js`, called from the sign-up and password-change paths via `features/auth/lib/passwordAuth.js`) using the **[Have I Been Pwned](https://haveibeenpwned.com/Passwords)** k-anonymity range API — only the first 5 characters of the password's SHA-1 leave the browser; fails open if HIBP is unreachable. This replaces Supabase's Pro-only *leaked password protection* (the project is on the **Free plan** since 2026-10-12). **Known gap:** it is not enforced server-side, so a caller using the Supabase Auth API directly with the anon key can bypass it (`tests/unit/useAuth-guard.test.js` keeps every in-repo password write behind the check).
- 💾 **Backups at rest**: nightly `pg_dump` → gzip → **`age`** (public-key) encryption → private Cloudflare R2 bucket, 30-day lifecycle. The plaintext dump is only ever piped, never written to disk; the private key is offline. Restore drill passed 2026-10-12 (see CONTEXT.md → CI/CD).

---

### ✍️ Signing

- 🪪 **Session JWTs** are minted and signed by **Supabase Auth** (asymmetric, ES256). This codebase holds **no** JWT signing secret; the Worker verifies signatures locally with the public JWKS (`jose`) — no per-request round-trip to Supabase.

---

### 🗝️ Key management

- 🖥️ **Worker secret**: `TMDB_API_KEY_SECRET` (`wrangler secret put`). The database connection string lives in the Hyperdrive config, not in the Worker. The Worker uses **no** Supabase service-role key.
- 🧰 **CI secrets (GitHub Actions)**: `SUPABASE_DB_POOLER_URL`, `AGE_PUBLIC_KEY`, R2 access keys (backup); `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` (manual Worker deploy). The **`age` private key is not stored anywhere online**.
- 🧑‍💻 **Local dev / tests**: root `.env` (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` for RLS tests), `worker/.dev.vars` — gitignored.
- 🌐 **Browser env**: publishable/anon Supabase key only (`VITE_*`); paired with RLS (T9).

---

### ⭐ Best practices followed

- 🪖 Hono `secureHeaders()`; **CORS** allow-list (`ALLOWED_ORIGINS`); **rate limits** (`RL_GLOBAL` per IP, `RL_MUTATION` per user on writes).
- 🧮 **Parameterized** SQL only (`postgres.js` tagged templates; `fetch_types:false` forbids array binds, so lists go through `IN ${sql(arr)}` / `string_to_array`); the global error handler returns `{ error: "Internal server error" }` and logs details server-side (T4).
- 📝 **Audit**: Worker mutations via `auditLog()` with allowlisted body fields (default: record no body), DB triggers on all user-data tables (migration 044), admin audit UI with an auth-events tab.
- 💾 **Encrypted, tested backups** with a restore drill, so a lost Supabase project is recoverable on the Free plan.

---

## 🔮 Future considerations

- 🔐 **Add MFA**
- 📋 **Security Protocols** — a written breach plan exists ([../compliance/DATA_BREACH_RESPONSE_PLAN.md](../compliance/DATA_BREACH_RESPONSE_PLAN.md)); rehearse it
- 🔒 **Server-side enforcement of the breached-password check** (currently client-side only)
- 🗑️ **Avatar orphaning** — `storage.objects` has no SELECT policy, so a user-side `storage.remove()` silently deletes nothing; replaced avatars are left in the bucket
