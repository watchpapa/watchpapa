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

## Risks

- Unauthenticated backend mutation endpoints (`/api/inject`, `/api/resolve`).
- Denial-of-service risk from unbounded ingestion trigger surface.
- Database TLS certificate verification disabled (`rejectUnauthorized: false`).
- Dependency vulnerabilities reported by audit (`sequelize`, `lodash`, `path-to-regexp`, `uuid`).
- API key usage in URL query parameters.
- Browser-readable persisted auth session tokens.
- Untrusted user metadata URL rendered as avatar image source.
- Missing explicit backend security header hardening middleware.
- Missing explicit production CSP/security-header policy at app layer.
- Potential CSRF exposure on backend POST flows if cookie-authenticated.
- Verbose error logging that may expose sensitive operational details.

## Future Considerations

