-- Rating history: one row per rating VALUE CHANGE, so a profile can show
-- "you rated this 6/10 on Mar 1, then 8/10 on Sep 5" instead of only the
-- current value. Deliberately keyed on (profile_id, media_type, tmdb_id) —
-- not a FK to user_rating.id — so history survives clearing + re-rating,
-- which deletes and later re-inserts a new user_rating row with a new id.
-- Clearing a rating (DELETE on user_rating) is not itself logged here; only
-- the initial rating and later value changes are.
CREATE TABLE public.user_rating_history (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id  UUID        NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  media_type  TEXT        NOT NULL CHECK (media_type IN ('movie', 'show', 'season', 'episode')),
  tmdb_id     BIGINT      NOT NULL,
  value       SMALLINT    NOT NULL CHECK (value >= 1 AND value <= 10),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX user_rating_history_lookup_idx ON public.user_rating_history (profile_id, media_type, tmdb_id, changed_at);

ALTER TABLE public.user_rating_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_rating_history: own read"
  ON public.user_rating_history
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());
-- No INSERT/UPDATE/DELETE policy for clients — rows are written only by the
-- SECURITY DEFINER trigger below, same convention as audit_user_follow_change
-- (migration 002).

CREATE OR REPLACE FUNCTION public.log_user_rating_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_rating_history (profile_id, media_type, tmdb_id, value, changed_at)
    VALUES (NEW.profile_id, NEW.media_type, NEW.tmdb_id, NEW.value, NEW.updated_at);
  ELSIF TG_OP = 'UPDATE' AND NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.user_rating_history (profile_id, media_type, tmdb_id, value, changed_at)
    VALUES (NEW.profile_id, NEW.media_type, NEW.tmdb_id, NEW.value, NEW.updated_at);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_user_rating_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS log_user_rating_change_trigger ON public.user_rating;
CREATE TRIGGER log_user_rating_change_trigger
  AFTER INSERT OR UPDATE ON public.user_rating
  FOR EACH ROW EXECUTE FUNCTION public.log_user_rating_change();
