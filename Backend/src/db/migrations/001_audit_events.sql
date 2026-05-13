-- Append-only audit log table.
-- RLS is enabled with no user-facing policies, so only the backend's direct
-- DB connection (which bypasses RLS) can write. anon and authenticated keys
-- have no access.

CREATE TABLE IF NOT EXISTS audit_events (
  id         BIGSERIAL    PRIMARY KEY,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  action     TEXT         NOT NULL,
  user_id    UUID,
  email      TEXT,
  ip         TEXT,
  method     TEXT         NOT NULL,
  path       TEXT         NOT NULL,
  body       JSONB
);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

-- No INSERT/SELECT/UPDATE/DELETE policies defined.
-- Result: anon and authenticated roles are blocked entirely.
-- The backend's postgres/service-role connection bypasses RLS and can INSERT.

-- Prevent accidental UPDATE/DELETE even from privileged roles by removing
-- the grants (service_role retains them via superuser path, but this signals
-- intent clearly to any future role grants).
REVOKE UPDATE, DELETE ON audit_events FROM PUBLIC;
