-- Adds a 90-day cooldown on username changes.
-- username_changed_at is NULL until the first deliberate change (initial setup is exempt).

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.enforce_username_change_cooldown()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only applies when changing from one non-null username to another.
  IF OLD.username IS NULL
     OR NEW.username IS NULL
     OR OLD.username IS NOT DISTINCT FROM NEW.username
  THEN
    RETURN NEW;
  END IF;

  -- Block the change if it was made within the last 90 days.
  IF OLD.username_changed_at IS NOT NULL
     AND OLD.username_changed_at > now() - interval '90 days'
  THEN
    RAISE EXCEPTION 'Username can only be changed once every 90 days. Next change available on %.',
      to_char(OLD.username_changed_at + interval '90 days', 'YYYY-MM-DD');
  END IF;

  NEW.username_changed_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_username_change_cooldown() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_username_change_cooldown ON public.profile;
CREATE TRIGGER trg_enforce_username_change_cooldown
  BEFORE UPDATE OF username ON public.profile
  FOR EACH ROW EXECUTE FUNCTION public.enforce_username_change_cooldown();
