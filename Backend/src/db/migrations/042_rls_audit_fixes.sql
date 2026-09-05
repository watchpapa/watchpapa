-- Fixes from an RLS/access-control audit (2026-09-05).
--
-- 1. Three SECURITY DEFINER trigger functions (033 guard_avatar_tier, 034
--    guard_watch_providers_tier, 039 log_user_rating_change) only revoked
--    execute FROM PUBLIC, which does NOT remove the direct EXECUTE grant
--    Supabase's default privileges give anon/authenticated on every new
--    function. The Supabase security advisor confirmed all three are
--    currently callable via /rest/v1/rpc/<name> by both roles. Postgres
--    refuses to run a RETURNS TRIGGER function outside trigger context, so
--    this isn't practically exploitable, but it's inconsistent with the
--    REVOKE EXECUTE ... FROM anon, authenticated pattern every sibling
--    trigger function already follows (see 018, 020).
REVOKE EXECUTE ON FUNCTION public.guard_avatar_tier()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_watch_providers_tier() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_user_rating_change()     FROM anon, authenticated;

-- Same gap on two functions created directly in Supabase (not in local
-- migrations, per 018's precedent) — wrapped so a fresh-DB dry-run doesn't
-- hard-fail if they don't exist there.
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END;
$$;

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.clean_audit_events_on_profile_delete() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END;
$$;

-- 2. reward_codes: "active codes read" (009) let any authenticated user
--    SELECT every active, unexpired code's literal value — no frontend
--    reads this table and no redeem/claim RPC exists yet, so it currently
--    serves no purpose except letting any user list and pre-empt codes
--    meant for controlled/individual distribution. Drop it; a future
--    redeem flow should validate a submitted code via a SECURITY DEFINER
--    RPC instead of exposing the table (same pattern as can_view_ratings
--    gating user_rating instead of a broad read policy).
DROP POLICY IF EXISTS "reward_codes: active codes read" ON public.reward_codes;
