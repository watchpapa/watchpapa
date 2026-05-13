-- Audit triggers for the F15 trust-boundary crossing: direct browser → Supabase
-- writes on user_followed_movies and user_followed_shows. These mutations
-- bypass the Express auditLog.js middleware, so without a DB-level trigger
-- they would leave no audit trail (threat T18 in docs/threat_model_guide.md).
--
-- The trigger runs inside Postgres in the same transaction as the mutation
-- and writes to the existing append-only audit_events table, mirroring the
-- shape of entries produced by middleware/auditLog.js.

CREATE OR REPLACE FUNCTION public.audit_user_follow_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
-- Hardens the function against search_path-based hijacking when invoked from
-- a SECURITY DEFINER context (Supabase best practice for trigger functions
-- that touch privileged tables like audit_events).
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action TEXT;
  v_method TEXT;
  v_path   TEXT;
  v_body   JSONB;
  v_user   UUID;
BEGIN
  -- Resolve the actor. auth.uid() reads request.jwt.claims set by Supabase
  -- on the connection; for direct-write paths from the SPA this is the
  -- authenticated user. Fall back to the row's profile_id, which RLS already
  -- constrains to auth.uid() on these tables.
  v_user := COALESCE(
    auth.uid(),
    CASE TG_OP
      WHEN 'INSERT' THEN NEW.profile_id
      ELSE OLD.profile_id
    END
  );

  IF TG_OP = 'INSERT' THEN
    v_method := 'POST';
    IF TG_TABLE_NAME = 'user_followed_movies' THEN
      v_action := 'follow_movie';
      v_body   := jsonb_build_object('movie_id', NEW.movie_id);
    ELSIF TG_TABLE_NAME = 'user_followed_shows' THEN
      v_action := 'follow_show';
      v_body   := jsonb_build_object('show_id', NEW.show_id);
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_method := 'DELETE';
    IF TG_TABLE_NAME = 'user_followed_movies' THEN
      v_action := 'unfollow_movie';
      v_body   := jsonb_build_object('movie_id', OLD.movie_id);
    ELSIF TG_TABLE_NAME = 'user_followed_shows' THEN
      v_action := 'unfollow_show';
      v_body   := jsonb_build_object('show_id', OLD.show_id);
    ELSE
      RETURN OLD;
    END IF;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_path := 'direct/' || TG_TABLE_NAME;

  INSERT INTO public.audit_events (action, user_id, email, ip, method, path, body)
  VALUES (v_action, v_user, NULL, NULL, v_method, v_path, v_body);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers fire regardless of EXECUTE grants, so the function is not exposed
-- to client roles via PostgREST. anon/authenticated cannot call it directly.
REVOKE ALL ON FUNCTION public.audit_user_follow_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS audit_user_followed_movies_change ON public.user_followed_movies;
CREATE TRIGGER audit_user_followed_movies_change
  AFTER INSERT OR DELETE ON public.user_followed_movies
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_follow_change();

DROP TRIGGER IF EXISTS audit_user_followed_shows_change ON public.user_followed_shows;
CREATE TRIGGER audit_user_followed_shows_change
  AFTER INSERT OR DELETE ON public.user_followed_shows
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_follow_change();
