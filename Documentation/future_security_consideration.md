# Future security considerations

The Movie Database (TMDB) is the canonical metadata source for Watchpapa, but API responses are not cryptographically attested to this application. Treat TMDB as a convenient upstream, not a security boundary: payloads can change shape over time, individual fields can be malformed or unexpectedly typed, and any hypothetical compromise or misconfiguration between your client and TMDB would surface as “normal” JSON.

Defense in depth helps: validate and normalize at ingest, add database constraints where they match product rules, and keep rendering layers safe (escaping text, building image URLs only from known-safe path patterns). This document records gaps and follow-ups for TMDB-backed scripts so they are not forgotten.

## Scripts

These Node ingestors live under `Backend/src/scripts/`:

- [`inject_person.js`](../Backend/src/scripts/inject_person.js)
- [`inject_genres.js`](../Backend/src/scripts/inject_genres.js)
- [`inject_jobs_and_departments.js`](../Backend/src/scripts/inject_jobs_and_departments.js)

### Already in good shape

- **SQL injection**: Queries use Sequelize named parameters (`replacements`), so TMDB-controlled strings are bound as values, not concatenated into SQL.
- **Batch integrity**: Genre and jobs/departments flows run inside a database transaction so a mid-batch failure does not leave half-written reference data.
- **Person ingest**: `inject_person.js` does the most application-level validation today—numeric `id`, required non-empty `name`, coerced `adult`, finite checks for `gender` and `popularity`, string-or-null for several text fields, and trimmed/deduplicated string nicknames for `person_aka`.

### Gaps and future hardening

Data from TMDB is **not** guaranteed to be well-typed, bounded, or display-safe; the scripts below reflect that reality.

- **Types**
  - `inject_genres.js`: Genre `name` is only truthy-checked, not enforced as `typeof string` before insert.
  - `inject_jobs_and_departments.js`: Department names and job entries are not required to be strings; invalid shapes may only fail when the driver or Postgres rejects the bind/insert.

- **Dates** (`inject_person.js`): `birthday` and `deathday` are passed through without validating ISO `YYYY-MM-DD` (or empty) before insert. Bad strings fail at the database layer rather than being caught early with a clear ingest error.

- **Size / availability (DoS)**: There are no max-length clamps on free-text fields. Very large strings or responses could stress workers, connection pools, or storage even though TMDB is usually well-behaved.

- **Semantic safety (XSS / URLs)**: There is no HTML stripping or sanitization at ingest. `profile_path` is not validated against a TMDB-style path pattern; risk is low if the UI always prefixes the official image base URL and never treats paths as arbitrary URLs, but stored values should still be considered untrusted for rich rendering.

- **Network**: `fetch` calls have no explicit timeout or `AbortController`; a slow or stuck upstream can hang a script run.

### Optional cross-cutting improvements

- Introduce a small shared helper (e.g. `tmdbFetch` with timeout) plus shared validators: trim strings, enforce max lengths, and validate date strings with a single regex or parser before SQL.
- For caps that must hold even if application code regresses, consider Postgres `CHECK` constraints or length limits on selected columns.

Revisit this document when adding new TMDB ingest scripts or when exposing person, genre, or job text in new surfaces (email, PDF exports, rich HTML, or other contexts where escaping assumptions differ from the main web UI).
