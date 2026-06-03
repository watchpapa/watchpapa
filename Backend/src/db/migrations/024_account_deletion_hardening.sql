-- Add ON DELETE CASCADE to user_followed_movies
ALTER TABLE public.user_followed_movies
  DROP CONSTRAINT IF EXISTS user_followed_movies_profile_id_fkey,
  ADD CONSTRAINT user_followed_movies_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to user_followed_shows
ALTER TABLE public.user_followed_shows
  DROP CONSTRAINT IF EXISTS user_followed_shows_profile_id_fkey,
  ADD CONSTRAINT user_followed_shows_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;

-- Trigger to clean audit_events immediately when a profile is deleted
CREATE OR REPLACE FUNCTION public.clean_audit_events_on_profile_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.audit_events WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_clean_audit_events_on_profile_delete ON public.profile;
CREATE TRIGGER trg_clean_audit_events_on_profile_delete
  AFTER DELETE ON public.profile
  FOR EACH ROW EXECUTE FUNCTION public.clean_audit_events_on_profile_delete();
