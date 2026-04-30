# Security Considerations

## Implemented

- **Threat: SQL injection through user-controlled query input**
  - Implemented: SQL queries in reviewed backend paths use parameterized replacements rather than direct string interpolation for user-provided values.

- **Threat: Cross-origin abuse from arbitrary browser origins**
  - Implemented: Backend CORS handling restricts allowed origins to known local frontend origins and handles preflight requests.

- **Threat: Duplicate-trigger ingestion spam for the same entity**
  - Implemented: Ingestion queue uses in-flight deduplication by key (`movie:<id>`, `show:<id>`, `person:<id>`) to avoid duplicate concurrent jobs for identical targets.

- **Threat: Sensitive backend route exposure by frontend route guards**
  - Implemented: Frontend route-level session checks are present to control access to authenticated pages in the UI.

- **Threat: Browser DOM injection via dangerous rendering APIs**
  - Implemented: No direct use of `dangerouslySetInnerHTML` was found in reviewed frontend code.

- **Threat: Unauthenticated access to backend mutation endpoints**
  - Implemented: `POST /api/inject` and `POST /api/resolve` now require a valid Supabase Bearer JWT via `requireAuth` middleware (`Backend/src/middleware/requireAuth.js`). Requests without a valid token receive 401.

- **Threat: Denial-of-service from unbounded request volume**
  - Implemented: `express-rate-limit` applied globally (120 req/min) and with a stricter limit on mutation routes (20 req/min) in `app.js`.

- **Threat: Missing security headers (clickjacking, MIME sniffing, etc.)**
  - Implemented: `helmet` middleware applied in `app.js`, setting X-Frame-Options, X-Content-Type-Options, HSTS, and other standard headers.

- **Threat: Oversized request bodies causing memory pressure**
  - Implemented: `express.json({ limit: "64kb" })` in `app.js` rejects requests with bodies exceeding 64 KB.

- **Threat: Malformed or out-of-range input to mutation routes**
  - Implemented: Both `inject.js` and `resolve.js` validate that `type` is one of `movie|show|person` and `tmdbId` is a positive integer within the expected TMDB ID range. Invalid inputs return 400.

- **Threat: Non-repudiation gap on sensitive backend actions**
  - Implemented: `auditLog` middleware (`Backend/src/middleware/auditLog.js`) writes a structured JSON entry to stdout for every request reaching `/api/inject` and `/api/resolve`, capturing timestamp, action, userId, email, IP, method, path, and body.

- **Threat: Unverified TLS certificate in production database connections**
  - Implemented: `rejectUnauthorized` in `database.js` is now `true` when `NODE_ENV=production`, enforcing certificate verification in deployed environments while keeping local dev unblocked.

- **Threat: CORS preflight not forwarding Authorization header**
  - Implemented: `Authorization` added to `Access-Control-Allow-Headers` so browsers can send the Bearer token on mutation requests.

## Security Audit — 2026-04-29

Performed a full review of all backend routes, middleware, and services. No HIGH or MEDIUM exploitable vulnerabilities were found. The following patterns were examined and confirmed safe:

- `findLocalId()` in `resolve.js` interpolates a table name into SQL, but is only ever called with hardcoded string literals — not user input. No injection path exists.
- `adultFilter` in `searchService.js` is constructed from a boolean and always produces either `""` or the hardcoded clause `AND adult = false` — no user-controlled SQL fragment.
- `requireAuth` middleware correctly validates Supabase JWTs server-side before any mutation route executes.
- Input validation in `inject.js` and `resolve.js` strictly enforces `type ∈ {movie, show, person}` and `tmdbId` as a positive integer ≤ 9,999,999 before any processing.

## Remaining Risks

- **Browser-readable persisted auth session tokens** — `persistSession: true` in `Frontend/src/lib/supabase.js` stores the Supabase session in localStorage, increasing exposure to XSS token theft. Acceptable if XSS surface is kept minimal; revisit if CSP is relaxed.
- **API key usage in URL query parameters** — TMDB API key appears in server-side fetch URLs (e.g., `resolve.js`). Key is never exposed to clients but will appear in server access logs. Rotate if logs are not tightly controlled.
- **Dependency vulnerabilities** — audit reports issues in `sequelize`, `lodash`, `path-to-regexp`, `uuid`. Run `npm audit fix` periodically.
- **No explicit production CSP policy** — `helmet` sets a default CSP; a stricter policy tailored to known asset origins should be set before public deployment.
- **Audit log is console-only** — structured audit entries are written to stdout. For production, route stdout to an append-only log aggregator (e.g., CloudWatch, Datadog) or persist to an `audit_events` DB table with write-only permissions for the app role.
- **Untrusted user metadata URL rendered as avatar image source** — avatar `src` comes from Supabase user metadata without sanitization. A malicious OAuth provider could inject a URL that leaks referer or triggers SSRF via a service worker.
- **Verbose error logging** — `console.error` in route handlers may emit stack traces or upstream error details. Ensure log output is not publicly accessible.
- **Latent PII exposure in audit log body field** — `auditLog` middleware logs `req.body` in full. Current routes only place `type` and `tmdbId` in the body, so no PII is logged today. If future mutation routes using this middleware accept PII fields (e.g., user display names, emails in the body), those will be written to stdout in plaintext. Add an explicit body allowlist (`{ type, tmdbId }`) to the audit entry to prevent accidental PII capture as the API grows.

## Future Considerations

- Migrate audit log from stdout to a dedicated `audit_events` DB table (append-only, no DELETE/UPDATE grants for the app role).
- Add a per-user rate-limit dimension (by `req.user.id`) in addition to the current IP-based limit.
- Set an explicit `helmet` CSP policy listing permitted script/style/image sources for the production frontend origin.
- Evaluate removing `persistSession: true` or scoping it to session-storage only, depending on threat model.
