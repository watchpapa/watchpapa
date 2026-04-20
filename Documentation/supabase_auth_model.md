# Supabase Auth Model (Watchpapa)

This document explains the `auth` schema model used for authentication, sessions, identities, OAuth, SSO, MFA, tokens, and WebAuthn.

## Overview

The schema is centered around one principal identity record:

- `users`

From that core entity, the model adds:

- session and token lifecycle tables (`sessions`, `refresh_tokens`, `one_time_tokens`),
- identity provider and login-flow tables (`identities`, `flow_state`, `oauth_client_states`),
- OAuth client/authorization/consent tables (`oauth_clients`, `oauth_authorizations`, `oauth_consents`),
- enterprise SSO/SAML configuration and relay tables,
- MFA and WebAuthn challenge/credential tables,
- audit and operational tables (`audit_log_entries`, `schema_migrations`, `instances`).

Most tables use:

- `uuid` primary keys,
- `created_at`/`updated_at` timestamps,
- explicit foreign keys back to `auth.users` or auth subsystem tables.

---

## Core Identity Tables

### `users`

Primary account table for authenticated identities, with email/phone credentials, metadata, confirmation fields, and lifecycle flags.

- Primary key: `id`
- Key profile/auth fields: `email`, `phone`, `encrypted_password`, `raw_app_meta_data`, `raw_user_meta_data`
- State flags: `is_super_admin`, `is_sso_user`, `is_anonymous`
- Lifecycle fields include `confirmed_at`, `banned_until`, `deleted_at`

Watchpapa links each optional app profile in `public.profile` to the same UUID: `public.profile.id` is a foreign key to `auth.users(id)`. User-specific follow lists in `public` reference `profile.id`, not `auth.users` directly. See [Supabase Public Model](./supabase_public_model.md).

### `identities`

Stores linked provider identities (for example email, OAuth, social providers) for a user.

- Primary key: `id`
- Foreign key: `user_id -> users.id`
- Provider fields: `provider`, `provider_id`
- Identity payload: `identity_data`

### `instances`

Instance-level auth configuration metadata.

- Primary key: `id`
- Includes `uuid`, `raw_base_config`, and timestamps

---

## Session and Token Lifecycle

### `sessions`

Tracks active and historical login sessions for users, including assurance level, expiry, IP/user agent, optional OAuth client linkage, and refresh-token coordination data.

- Primary key: `id`
- Foreign key: `user_id -> users.id`
- Foreign key: `oauth_client_id -> oauth_clients.id`

### `refresh_tokens`

Refresh-token records linked to sessions for token rotation/revocation flows.

- Primary key: `id` (`bigint` sequence-based)
- Foreign key: `session_id -> sessions.id`
- Token lineage support via `parent`

### `one_time_tokens`

Stores one-time token hashes used for short-lived actions (verification/recovery style flows).

- Primary key: `id`
- Foreign key: `user_id -> users.id`
- Includes `token_type`, `token_hash`, `relates_to`

### `flow_state`

Transient state for auth and provider flows (auth code, PKCE challenge, provider tokens, invite/linking references).

- Primary key: `id`
- Optional user linkage: `user_id`
- Optional OAuth state linkage: `oauth_client_state_id`

---

## OAuth Model

### `oauth_clients`

Registered OAuth clients and their metadata/auth settings.

- Primary key: `id`
- Registration/auth fields include `registration_type`, `client_type`, `token_endpoint_auth_method`
- Redirect and grant configuration in `redirect_uris` and `grant_types`

### `oauth_authorizations`

Authorization transaction records between a user and OAuth client (authorization code flow context, scope, redirect URI, expiry, approval status).

- Primary key: `id`
- Unique business keys: `authorization_id`, optional `authorization_code`
- Foreign key: `client_id -> oauth_clients.id`
- Foreign key: `user_id -> users.id`

### `oauth_consents`

Persisted grants by user to OAuth clients for specific scopes.

- Primary key: `id`
- Foreign key: `user_id -> users.id`
- Foreign key: `client_id -> oauth_clients.id`
- Revocation support via `revoked_at`

### `oauth_client_states`

Client-side OAuth flow state records (for example PKCE `code_verifier` and provider type).

- Primary key: `id`

### `custom_oauth_providers`

Custom external OAuth/OIDC provider configurations, including endpoints, client credentials, mappings, and discovery cache details.

- Primary key: `id`
- Unique provider key: `identifier`
- Supports dynamic discovery and explicit endpoint overrides

---

## SSO and SAML

### `sso_providers`

Base SSO provider records (including `resource_id` and enabled/disabled status).

- Primary key: `id`

### `sso_domains`

Domain-to-SSO-provider mapping for routing enterprise sign-ins.

- Primary key: `id`
- Foreign key: `sso_provider_id -> sso_providers.id`

### `saml_providers`

SAML provider configuration linked to SSO providers.

- Primary key: `id`
- Foreign key: `sso_provider_id -> sso_providers.id`
- Includes `entity_id`, `metadata_xml`, optional `metadata_url`, and attribute mapping

### `saml_relay_states`

Relay state tracking for SAML request/response cycles and auth flow continuation.

- Primary key: `id`
- Foreign key: `sso_provider_id -> sso_providers.id`
- Foreign key: `flow_state_id -> flow_state.id`

---

## MFA and WebAuthn

### `mfa_factors`

Registered MFA factors per user (for example TOTP, phone, WebAuthn-backed factor metadata).

- Primary key: `id`
- Foreign key: `user_id -> users.id`
- Includes `factor_type`, `status`, secrets/phone, and WebAuthn metadata fields

### `mfa_challenges`

MFA challenge attempts issued against a factor.

- Primary key: `id`
- Foreign key: `factor_id -> mfa_factors.id`
- Includes verification timestamp, IP, OTP/WebAuthn challenge data

### `mfa_amr_claims`

Authentication method reference (AMR) claims associated with sessions.

- Primary key: `id`
- Foreign key: `session_id -> sessions.id`
- Stores `authentication_method` with create/update timestamps

### `webauthn_challenges`

Standalone WebAuthn challenge state for signup/registration/authentication flows.

- Primary key: `id`
- Foreign key: `user_id -> users.id`
- Includes `session_data` and explicit expiry

### `webauthn_credentials`

Persisted WebAuthn credentials (credential ID, public key, counters, transport/backup flags, usage timestamps).

- Primary key: `id`
- Foreign key: `user_id -> users.id`

---

## Audit and Operations

### `audit_log_entries`

Auth audit event log entries containing structured payload and source IP metadata.

- Primary key: `id`

### `schema_migrations`

Migration version tracking for auth schema changes.

- Primary key: `version`

---

## Cardinality Summary

- `users` 1 -> 0..1 `public.profile` (at most one profile row per user; `profile.id` references `users.id`)
- `users` 1 -> many `identities`
- `users` 1 -> many `sessions`
- `users` 1 -> many `one_time_tokens`
- `users` 1 -> many `oauth_authorizations` (optional per authorization)
- `users` 1 -> many `oauth_consents`
- `users` 1 -> many `mfa_factors`
- `users` 1 -> many `webauthn_challenges` (optional)
- `users` 1 -> many `webauthn_credentials`
- `sessions` 1 -> many `refresh_tokens`
- `sessions` 1 -> many `mfa_amr_claims`
- `oauth_clients` 1 -> many `oauth_authorizations`
- `oauth_clients` 1 -> many `oauth_consents`
- `sso_providers` 1 -> many `sso_domains`
- `sso_providers` 1 -> many `saml_providers`
- `sso_providers` 1 -> many `saml_relay_states`
- `mfa_factors` 1 -> many `mfa_challenges`
- `flow_state` 1 -> many `saml_relay_states` (optional flow linkage)

---

## Notes and Observations

- The schema separates user identity (`users`) from provider identities (`identities`) and from runtime session/token state.
- Application-owned fields (username, date of birth, content ratings, roles) live in `public.profile`, which anchors foreign keys for user follow tables while keeping `auth` focused on authentication.
- OAuth support is comprehensive: client registration, authorization transactions, persisted consents, and custom provider definitions.
- Enterprise auth is modeled with a layered SSO/SAML design (`sso_providers` + `sso_domains` + `saml_*`).
- MFA is represented as factors, challenges, and AMR claims tied back to sessions.
- Several columns are typed as `USER-DEFINED` enums/domains (for example factor/status, OAuth response/status/client types), so exact allowed values depend on type definitions not included in this SQL excerpt.
