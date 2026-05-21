# Security Information 🛡️

>Updated: 2 May 2026

## Table of contents

- [Threat Model](#threat-model)
- [Legend](#legend)
  - [Entities](#entities-marked-as-rectangles)
  - [Processes](#processes-marked-as-rounded-rectangles)
  - [Data stores](#data-stores-marked-as-cyliders)
  - [Data flows](#data-flows)
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

![watchpapa.tv threat model](<../public/readme assets/watchpapa.tv-Threat Model-2:05:2026.png>)

### 📋 Legend

#### 👥 Entities (Marked as rectangles)

| Label | Description |
|-------|-------------|
| `[E1] Anonymous User` | Unauthenticated browser visitor (search, browse) |
| `[E2] Authenticated User` | Logged-in user (follow, resolve, inject) |
| `[E3] TMDB API` | External third-party metadata source (read-only ingest) |
| `[E4] Supabase Auth` | External managed identity provider (issues JWTs) |
| `[E5] Resend SMTP` | External email delivery service (OTP, verification emails) |

#### ⚙️ Processes (Marked as rounded rectangles)

| Label | Description |
|-------|-------------|
| `[P1] React Frontend (SPA)` | Browser-side UI — Vite/React 19, lives in user's browser |
| `[P2] Express API Server` | Node.js/Express backend — auth, search, inject, resolve |
| `[P3] Ingestion Scripts` | Inject: single&batches, update |
| `[P4] Supabase RLS Engine` | Supabase-managed policy enforcement layer |

#### 💾 Data stores (Marked as cyliders)

| Label | Description | Sensitivity |
|-------|-------------|-------------|
| `[D1] PostgreSQL DB (Supabase)` | All media metadata, user follows, profiles, script logs | High |
| `[D2] auth.users (Supabase)` | User credentials, email, OAuth tokens | Critical |
| `[D3] JWT in localStorage` | Session token persisted in browser storage | High |
| `[D4] Server stdout / logs` | Audit log: user ID, email, IP, request body, timestamps | Medium |
| `[D5] TMDB API Response Cache` | In-memory dedup queue (per-process) | Low |

#### 🔀 Data flows

| Label | From | To | Data | Protocol |
|-------|------|----|------|----------|
| `[F1a]` | E1 (Anonymous User) | P1 (Frontend) | UI interaction, search/browse input (no identity) | HTTPS |
| `[F1a-r]` | P1 (Frontend) | E1 (Anonymous User) | Rendered public pages/results | HTTPS |
| `[F1b]` | E2 (Authenticated User) | P1 (Frontend) | UI interaction, account/credential input | HTTPS |
| `[F1b-r]` | P1 (Frontend) | E2 (Authenticated User) | Rendered authenticated UI state | HTTPS |
| `[F2]` | P1 (Frontend) | E4 (Supabase Auth) | Email + password / OAuth token | HTTPS |
| `[F3]` | E4 (Supabase Auth) | P1 (Frontend) | JWT access token | HTTPS |
| `[F4]` | E4 (Supabase Auth) | D2 (`auth.users`) | Credential/user record create + lookup | Internal (Supabase) |
| `[F5]` | E4 (Supabase Auth) | E5 (Resend SMTP) | OTP / verification email | Internal (Supabase) |
| `[F6]` | E5 (Resend SMTP) | E2 (User) | OTP email | SMTP/Email |
| `[F7]` | P1 (Frontend) | P2 (API Server) | Search query (no auth) | HTTPS + CORS |
| `[F7-r]` | P2 (API Server) | P1 (Frontend) | Search response payload | HTTPS + CORS |
| `[F8]` | P1 (Frontend) | P2 (API Server) | Resolve/Inject request + JWT Bearer | HTTPS + CORS |
| `[F8-r]` | P2 (API Server) | P1 (Frontend) | Resolve/Inject result + status/error payload | HTTPS + CORS |
| `[F9]` | P2 (API Server) | E4 (Supabase Auth) | JWT verification (admin client) | HTTPS |
| `[F9-r]` | E4 (Supabase Auth) | P2 (API Server) | JWT claims verification result | HTTPS |
| `[F10]` | P2 (API Server) | D1 (PostgreSQL) | Search queries, upserts (parameterized SQL) | TLS/TCP |
| `[F10-r]` | D1 (PostgreSQL) | P2 (API Server) | Query results / write status | TLS/TCP |
| `[F11]` | P2 (API Server) | E3 (TMDB API) | Metadata fetch (API key in header) | HTTPS |
| `[F12]` | E3 (TMDB API) | P2 (API Server) | Movie/show/person JSON | HTTPS |
| `[F13]` | P3 (Ingestion Scripts) | E3 (TMDB API) | Batch fetch requests | HTTPS |
| `[F13-r]` | E3 (TMDB API) | P3 (Ingestion Scripts) | Movie/show/person JSON (ingestion responses) | HTTPS |
| `[F14]` | P3 (Ingestion Scripts) | D1 (PostgreSQL) | Bulk upserts inside transactions | TLS/TCP |
| `[F14-r]` | D1 (PostgreSQL) | P3 (Ingestion Scripts) | Bulk write status / transaction result | TLS/TCP |
| `[F15]` | P1 (Frontend) | D1 (PostgreSQL) via Supabase JS | Follow/unfollow writes (RLS-protected) | HTTPS |
| `[F15-r]` | D1 (PostgreSQL) | P1 (Frontend) via Supabase JS | Follow state reads / mutation result rows | HTTPS |
| `[F16]` | P4 (RLS Engine) | D1 (PostgreSQL) | Policy-filtered reads/writes | Internal |
| `[F17]` | P2 (API Server) | D4 (stdout/logs) | Audit log entries (user ID, IP, body) | stdout |
| `[F18]` | P1 (Frontend) | D3 (localStorage) | JWT token write/read | Browser API |
| `[F18-r]` | D3 (localStorage) | P1 (Frontend) | JWT token retrieval for session restore | Browser API |
| `[F19]` | P2 (API Server) | D5 (TMDB response cache) | Cache lookup/set for dedup + short-lived response reuse | In-memory |
| `[F19-r]` | D5 (TMDB response cache) | P2 (API Server) | Cache hit payload / dedup state | In-memory |

---

### 🔲 Threat boundaries (Marked as purple/blue-ish dotted lines)

#### 🎯 STRIDE threats (Marked next to threat boundaries as T#)

#### T1-T5

---

**T1** (application) — 🎭 Spoofing — JWT replay

- ✅ **Prevention:** Server-side JWT verification via Supabase admin client in requireAuth on every protected request
- ⚠️ **Known gap:** No server-side revocation — stolen token remains valid until natural expiry; accepted trade-off: localStorage is required for cross-tab session sharing

---

**T2** (application) — 🔧 Tampering — malformed inject/resolve body

- ✅ **Prevention:** Type enum check (movie|show|person), integer range validation (1–9,999,999), unknown-field rejection (extra keys return 400)
- ⚠️ **Known gap:** None

---

**T3** (application) — 📜 Repudiation — user denies inject/resolve request

- ✅ **Prevention:** Audit middleware writes userId, email, IP, timestamp, method, path, and allowlisted body to both stdout and the append-only audit_events DB table on every mutation
- ⚠️ **Known gap:** None

---

**T4** (application) — 👁️ Information disclosure — stack traces in error responses

- ✅ **Prevention:** Global Express error handler always returns { error: "Internal server error" }; in production only err.message is logged to stdout, never the full stack
- ⚠️ **Known gap:** None

---

#### T6-T9

---

**T5** (application) — ⛔ Denial of service — inject queue exhaustion

- ✅ **Prevention:** IP-based rate limit (20 req/min) plus per-user rate limit (20 req/min keyed by req.user.id) applied after auth; dedup queue prevents duplicate concurrent jobs for the same entity
- ⚠️ **Known gap:** Both limiters are in-process — multi-instance deployments share no counter (problem for horizontal scaling); no circuit breaker if TMDB is unresponsive and stalls workers

---

**T6** (application) — 🔑 Elevation of privilege — accessing another user's follows

- ✅ **Prevention:** RLS enforces profile_id = auth.uid() on user_followed_movies and user_followed_shows; isValidId guard on all follow/unfollow IDs before any write is attempted
- ⚠️ **Known gap:** Entirely reliant on correct RLS configuration

---

**T7** (application) — 🎭 Spoofing — forging another user's profile_id

- ✅ **Prevention:** RLS profile_id = auth.uid() — Supabase Auth guarantees auth.uid() matches the authenticated user; the anon key cannot forge another user's JWT
- ⚠️ **Known gap:** If an RLS policy is missing or misconfigured on any table, there is no backend enforcement layer as a fallback

---

**T8** (application) — 🔑 Elevation of privilege — RLS misconfiguration

- ✅ **Prevention:** RLS enabled on all user-facing tables; all write policies scoped to auth.uid();
- ⚠️ **Known gap:** A new table added without RLS would be openly accessible with just the anon key (new tables must be added to the tests)

---

**T9** (application) — 👁️ Information disclosure — anon key in frontend bundle

- ✅ **Prevention:** RLS enabled on all user-facing tables; all write policies scoped to auth.uid()
- ⚠️ **Known gap:** A new table added without RLS would be openly accessible with just the anon key

---

#### T10-T13

---

**T10** (application) — 🔧 Tampering — malicious TMDB response data

- ✅ **Prevention:** sanitizeTmdb.js enforces type, length , ISO date format, ISO language code format, strict-boolean coercion, and numeric range clamping on every TMDB-sourced field.
- ⚠️ **Known gap:** Check exact TMDB charter limits to make it even stricter

---

**T11** (application) — 👁️ Information disclosure — TMDB API key in logs

- ✅ **Prevention:** maskApiKey() in tmdbRateLimitedFetch rewrites any network error message, replacing api_key=... with api_key=[REDACTED] before it reaches stdout
- ⚠️ **Known gap:** Masking applies only inside tmdbRateLimitedFetch; any code that logs a TMDB URL outside that function would not be masked

---

**T12** (application) — ⛔ Denial of service — TMDB rate limit exceeded

- ✅ **Prevention:** Per-process sliding window limiter (35 req/s); 429/503 responses trigger exponential backoff with up to 8 retries, honouring Retry-After headers
- ⚠️ **Known gap:** Counter lives in process memory — multiple backend instances would collectively exceed TMDB's limit; exact TMDB API limit is unknown its between 40-60 req/s per IP

---

**T13** (network) — 🎭 Spoofing — TMDB response spoofed via MITM

- ✅ **Prevention:** TMDB fetches use HTTPS; TLS rejectUnauthorized: true on all DB connections
- ⚠️ **Known gap:** Compromised CA (Certificate Authority) or successful DNS poisoning can still succeed despite TLS; requires infrastructure-level fix like stronger DNS protection

---

#### T14-T16

---

**T14** (application) — 👁️ Information disclosure — audit log captured by untrusted aggregator

- ✅ **Prevention:** Audit body restricted to allowlisted fields only (type, tmdbId); no request payload PII beyond userId/email/IP which are inherently required for a useful audit trail
- ⚠️ **Known gap:** userId, email, and IP are necessarily present in every audit entry - **fix:** encrypt log trasnportation/storage, restrict access (Supabase Dashboard)

---

**T15** (application) — 📜 Repudiation — stdout logs not append-only

- ✅ **Prevention:** Audit middleware persists every entry to the audit_events table in Supabase — RLS-protected, no UPDATE/DELETE policies, REVOKE on PUBLIC; table is live
- ⚠️ **Known gap:** None

---

**T16** (application) — 👁️ Information disclosure — env key leak via error response

- ✅ **Prevention:** Keys stored in environment variables only; production error handler logs err.message only; all responses return only { error: "Internal server error" }; no debug or env introspection endpoints exist
- ⚠️ **Known gap:** None within the codebase; infrastructure - ToBeConfigured

---

#### T17

---

**T17** (application) — 👁️ Information disclosure — XSS reads JWT

- ✅ **Prevention:** helmet() security headers; CORS restricted to known origins; parameterized SQL prevents stored XSS via DB; cookie consent banner implemented — JWT stored in localStorage only when user explicitly accepts cookies, otherwise sessionStorage (token does not survive tab close); consent-aware Supabase storage adapter (Frontend/src/lib/supabase.js) and migration helper in Frontend/src/lib/cookieConsent.js migrate sb-* keys between storages on accept/decline
- ⚠️ **Known gap:** localStorage is still JS-readable if XSS occurs while the user has accepted cookies; HttpOnly cookies would be fully immune but require backend session management; no explicit CSP policy defined beyond helmet defaults

---

#### T18

---

**T18** (application) — 📜 Repudiation — direct follow/unfollow writes (F15) bypass auditLog.js

- ✅ **Prevention:** Postgres trigger `audit_user_follow_change()` writes a row to `audit_events` with `auth.uid()` as `user_id`, the followed entity id in `body`, and method/path mirroring the API audit shape
- ⚠️ **Known gap:** user_id is the canonical identifier for repudiation purposes (still thinking how to track it better)


---

### ⚡ Other threats

- 📱 **Device theft** — device that has stored `.env` keys and other credentials
- 🌐 **Mono-culture related risks** — project relies on availability of: Supabase, TMDB, Resend, (hosting:TBD)
- 🔓 **Lost, stolen, or unlocked device with an active session** — browser storage may still hold a valid JWT; usable until natural expiry with no server-side revocation (see T1, T17); complements developer `.env` exposure on theft
- 🔍 **Public `/api/search` overload** — unauthenticated callers can spike DB/API load; mitigated by global IP rate limit only; horizontally scaled backends share no distributed counter (same class of residual as T5/T12 unless limits are centralized)
- ✉️ **Authentication email channel (OTP / recovery via Supabase → Resend)** — email sits outside HTTPS-only APIs; phishing, spoofed mails, or a compromised inbox can regain access; flows align with F5/F6 rather than Bearer-only paths
- 🌍 **`ALLOWED_ORIGINS` / CORS in production** — list must match every deployed SPA origin exactly; stale or incorrect values strand legitimate users or weaken cross-origin controls if tightening is skipped when adding origins

---

### 🔐 Authentication

- 🔑 Supabase Auth (no custom credential DB).
- 💾 Browser: anon key, persisted session, auto-refresh; tokens in localStorage (cookies accepted) or sessionStorage (`supabase.js` + cookie consent).
- 🚪 Sign-in: email/password, Google, GitHub; signup OTP + forgot-password flows via Supabase APIs.
- 🔄 App load: `getSession` → `getUser`; bad session cleared; `onAuthStateChange` updates UI; `ProtectedRoute` + username setup gate.
- 🛂 API: `/api/inject` and `/api/resolve` need `Bearer` JWT; `requireAuth` validates with admin `auth.getUser(token)`, sets `req.user`. `/api/search` is public.
- ⏱️ No server-side revocation (see T1); JWT validity = Supabase token lifetime.

---

### 🏷️ Authorization

- 🔒 User-scoped data in Supabase Postgres uses **RLS** (`profile`, `user_followed_movies`, `user_followed_shows`; policies tie rows to `auth.uid()` — see T6–T9).
- 📋 **`audit_events`**: RLS on, **no** policies for anon/authenticated — clients cannot read/write it; backend inserts it
- ✔️ Express mutations only prove identity (`requireAuth`); **fine-grained access** for Supabase reads/writes from the browser is enforced by **RLS**, not duplicate checks in Node.

---

### ✔️ Validation

- 📦 **`/api/inject`, `/api/resolve`**: body must be exactly `{ type, tmdbId }`; `type ∈ {movie, show, person}`; `tmdbId` integer `1 … 9_999_999`; unknown keys → 400 (`inject.js`, `resolve.js`).
- 🔎 **`/api/search`**: `q` trimmed, length 2–100 (`search.js`).
- 🎬 **TMDB ingestion**: field tightening in `sanitizeTmdb.js` (types, lengths, dates, booleans, ranges — see T10).
- 🖥️ **UI**: username rules + positive integer IDs before follow toggles (`validate.js`, hooks).

---

### 🔒 Encryption

- 🌐 **TMDB / Supabase HTTP**: HTTPS (**TLS**) for all browser ↔ Supabase and app ↔ TMDB traffic (`fetch`, supabase-js).
- 🗄️ **Postgres (Sequelize)**: TLS enabled via `dialectOptions.ssl`; **`rejectUnauthorized: true` in production** (`database.js`). Non-prod may relax verification for local/dev DBs.
- 🔐 **Supabase Auth — passwords at rest**: Not encrypted for later decryption — they are stored as **one-way hashes**. New passwords use **bcrypt** (salt per hash); only that hash goes in Postgres (`auth.users.encrypted_password` is a **historical misnomer** — it holds a bcrypt hash, not reversible ciphertext). Migrated accounts may retain other hash formats Supabase recognizes (e.g. Argon2). Official detail: [Supabase password security](https://supabase.com/docs/guides/auth/password-security).
- 🛡️ **Breached-password check**: Enabled on the Supabase project's Auth settings — **[Have I Been Pwned](https://haveibeenpwned.com/Passwords)** (**Pwned Passwords**) is used to reject passwords that appear in known data breaches (sign-up and password-change flows run through **Supabase Auth**, not Watchpapa app code). How it fits with password policies: [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

---

### ✍️ Signing

- 🪪 **Session JWTs** are minted and signed by **Supabase Auth**; this codebase does **not** hold a JWT signing secret or verify signatures locally — **`auth.getUser(token)`** delegates validation to Supabase (`requireAuth.js`).

---

### 🗝️ Key management

- 🖥️ **Server-only env**: `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `TMDB_API_KEY_SECRET` (and related) — never shipped to the frontend (see T16).
- 🌐 **Browser env**: publishable/anon Supabase key only (`VITE_*`); paired with RLS (T9).

---

### ⭐ Best practices followed

- 🪖 `helmet()`; **CORS** restricted to configured origins; **rate limits** (global + stricter on mutations + per-user on inject/resolve).
- 🧮 **Parameterized** SQL via Sequelize; production API errors sanitized (T4).
- 📝 **Audit** mutations with allowlisted body fields; Postgres trigger for follow changes (T18).

---

## 🔮 Future considerations

- 🔐 **Add MFA**
- 📋 **Security Protocols** — What to do in case of leak/breach? (Not yet implemented, for now action is just take the app down)
