-- Prevent users from escalating their own role or stealing referral credit.
-- Column-level REVOKE is the primary defence; the trigger is a second layer for
-- any edge case that might bypass the privilege check.

-- ─── Column-level REVOKE ──────────────────────────────────────────────────────
-- Even though RLS allows users to UPDATE their own profile row (e.g. username),
-- these two columns must never be user-writable.
REVOKE UPDATE (role, referral_code) ON public.profile FROM authenticated;

-- ─── guard_profile_sensitive_columns ─────────────────────────────────────────
-- BEFORE UPDATE trigger: raises an error if role or referral_code changed while
-- running as the authenticated role. Legitimate admin writes run as service_role
-- and are not blocked.
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: role cannot be changed by the authenticated role'
        USING ERRCODE = 'P0001';
    END IF;

    IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: referral_code cannot be changed by the authenticated role'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_sensitive_columns() FROM PUBLIC;

DROP TRIGGER IF EXISTS guard_profile_columns ON public.profile;
CREATE TRIGGER guard_profile_columns
  BEFORE UPDATE ON public.profile
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_sensitive_columns();
