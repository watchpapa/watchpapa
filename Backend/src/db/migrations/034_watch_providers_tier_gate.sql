-- Choosing specific streaming services ("My streaming services" in Settings —
-- profile.setting_watch_providers) is a Pro+ feature. Watch REGIONS
-- (setting_watch_regions) stay open to every tier — they only pick which
-- region(s) the "Where to watch" panel shows, not a personalized provider
-- list. Same pattern as guard_avatar_tier (migration 033): the client-side UI
-- already hides the provider grid below Pro, this trigger is the real gate.
CREATE OR REPLACE FUNCTION public.guard_watch_providers_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user = 'authenticated'
     AND cardinality(NEW.setting_watch_providers) > 0
     AND OLD.setting_watch_providers IS DISTINCT FROM NEW.setting_watch_providers
  THEN
    IF public.get_effective_tier(NEW.id) NOT IN ('pro', 'pro_plus', 'god') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: choosing streaming services requires Pro or higher'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_watch_providers_tier() FROM PUBLIC;

DROP TRIGGER IF EXISTS guard_profile_watch_providers_tier ON public.profile;
CREATE TRIGGER guard_profile_watch_providers_tier
  BEFORE UPDATE ON public.profile
  FOR EACH ROW EXECUTE FUNCTION public.guard_watch_providers_tier();
