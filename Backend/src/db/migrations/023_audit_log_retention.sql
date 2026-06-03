-- Enable pg_cron extension (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 02:00 UTC
-- Deletes audit_events rows older than 90 days
-- Runs as postgres superuser, unaffected by REVOKE DELETE ON audit_events FROM PUBLIC
SELECT cron.schedule(
  'audit-events-90d-cleanup',
  '0 2 * * *',
  $$DELETE FROM public.audit_events WHERE created_at < NOW() - INTERVAL '90 days'$$
);
