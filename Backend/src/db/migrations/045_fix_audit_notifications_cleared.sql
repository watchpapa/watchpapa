-- 045_fix_audit_notifications_cleared — hotfix for a bug in 044.
--
-- audit_notifications_cleared() used min(recipient_id) as a fallback actor
-- when auth.uid() is null, but Postgres has no min() aggregate for uuid
-- ("function min(uuid) does not exist"), so every bulk notification-clear
-- statement raised and rolled back. Swap it for array_agg(...)[1], which
-- works for any type and just needs "some row's" recipient_id.

CREATE OR REPLACE FUNCTION public.audit_notifications_cleared()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
  v_user  uuid := auth.uid();
BEGIN
  IF public.audit_skip() THEN RETURN NULL; END IF;
  SELECT count(*), COALESCE(v_user, (array_agg(recipient_id))[1]) INTO v_count, v_user FROM deleted_rows;
  IF v_count > 0 THEN
    PERFORM public.audit_write('notifications_cleared', v_user, 'DELETE', 'notification', jsonb_build_object('count', v_count));
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_notifications_cleared() FROM PUBLIC, anon, authenticated;
