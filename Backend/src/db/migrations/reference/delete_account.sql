-- REFERENCE ONLY — not a migration. This is the body of public.delete_account()
-- as it exists in production (created directly in the Supabase dashboard, per
-- 018's note; extracted 2026-09-05 with pg_get_functiondef). Checked in so the
-- deletion path is reviewable from the repo.
--
-- Note it SOFT-deletes: profile.deleted_at is set and the username replaced,
-- auth.users is banned and its email suffixed — the profile row is NOT
-- deleted, so 024's AFTER DELETE audit cleanup never fires from this path.
-- The `account_deleted` audit row comes from 044's profile UPDATE trigger.

CREATE OR REPLACE FUNCTION public.delete_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  uid uuid := auth.uid();
  ts timestamptz := now();
  email_suffix text := '-deleted|id=' || uid::text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.user_followed_movies where profile_id = uid;
  delete from public.user_followed_shows where profile_id = uid;

  update public.profile
  set deleted_at = coalesce(deleted_at, ts),
      updated_at = ts,
      username = case
        when deleted_at is null then 'deleted_' || left(replace(uid::text, '-', ''), 12)
        else username
      end,
      setting_display_adult_content = false
  where id = uid;

  delete from auth.identities where user_id = uid;

  update auth.users u
  set deleted_at = coalesce(deleted_at, ts),
      updated_at = ts,
      banned_until = coalesce(banned_until, '9999-12-31 23:59:59+00'::timestamptz),
      email = case
        when email is null then null
        when position(email_suffix in email) > 0 then email
        else email || email_suffix
      end,
      email_change = case
        when email_change is null then null
        when position(email_suffix in email_change) > 0 then email_change
        else email_change || email_suffix
      end
  where id = uid;
end;
$function$
