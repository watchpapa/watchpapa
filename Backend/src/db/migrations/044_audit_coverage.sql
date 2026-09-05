-- 044_audit_coverage — record every user/admin action in public.audit_events.
--
-- Before this, only two Worker routes (referral, rewards) and the follow/
-- unfollow triggers (002/030) wrote audit rows; ~75 direct-Supabase writes
-- (ratings, watch log, watchlists, favourites, profile/settings, social) and
-- 16 Worker mutations (every admin route, import, announcements) were
-- invisible. This migration:
--   1. widens audit_events with status / target_user_id / source + indexes;
--   2. adds one generic SECURITY DEFINER row trigger (audit_row_change) and
--      attaches it to every user-data table;
--   3. adds a profile UPDATE trigger that emits one row *per changed group*
--      (never the whole row) and detects soft-deletion (delete_account() sets
--      deleted_at — it does not DELETE the row, so 024's AFTER DELETE cleanup
--      never fires in practice);
--   4. a statement-level trigger for bulk notification clears;
--   5. an escape hatch — SET LOCAL watchpapa.audit_skip = '1' — so the Worker's
--      bulk paths (import commit) log one summary row instead of thousands;
--   6. pins search_path on 024's cleanup function.
-- Action names are the registry in worker/src/auditActions.js.

-- ───────────────────────────── 1. table ───────────────────────────────────
ALTER TABLE public.audit_events
  ADD COLUMN IF NOT EXISTS status         SMALLINT,
  ADD COLUMN IF NOT EXISTS target_user_id UUID,
  ADD COLUMN IF NOT EXISTS source         TEXT NOT NULL DEFAULT 'worker'
    CHECK (source IN ('worker', 'db', 'auth'));

CREATE INDEX IF NOT EXISTS audit_events_user_created_idx   ON public.audit_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_action_created_idx ON public.audit_events (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_target_idx         ON public.audit_events (target_user_id) WHERE target_user_id IS NOT NULL;

-- Rows written by the existing follow triggers are 'db' events.
UPDATE public.audit_events SET source = 'db' WHERE path LIKE 'direct/%' AND source = 'worker';

-- ───────────────────────────── helpers ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_skip()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$ SELECT current_setting('watchpapa.audit_skip', true) = '1' $$;
REVOKE EXECUTE ON FUNCTION public.audit_skip() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_write(
  p_action text, p_user uuid, p_method text, p_table text, p_body jsonb, p_target uuid DEFAULT NULL
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.audit_events (action, user_id, email, ip, method, path, body, status, target_user_id, source)
  VALUES (p_action, p_user, NULL, NULL, p_method, 'direct/' || p_table, p_body, NULL, p_target, 'db')
$$;
REVOKE EXECUTE ON FUNCTION public.audit_write(text, uuid, text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- ───────────────────────────── 2. generic row trigger ─────────────────────
-- One function, one CASE per table; the actor is auth.uid() when the write
-- came through PostgREST, else the row's owner (Worker/postgres-role writes).
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action text;
  v_body   jsonb := '{}'::jsonb;
  v_user   uuid  := auth.uid();
  v_target uuid  := NULL;
  v_method text  := CASE TG_OP WHEN 'INSERT' THEN 'POST' WHEN 'UPDATE' THEN 'PATCH' ELSE 'DELETE' END;
BEGIN
  IF public.audit_skip() THEN RETURN COALESCE(NEW, OLD); END IF;

  CASE TG_TABLE_NAME
    WHEN 'user_rating' THEN
      v_user := COALESCE(v_user, CASE TG_OP WHEN 'DELETE' THEN OLD.profile_id ELSE NEW.profile_id END);
      IF TG_OP = 'INSERT' THEN
        v_action := 'rating_set';
        v_body := jsonb_build_object('media_type', NEW.media_type, 'tmdb_id', NEW.tmdb_id, 'value', NEW.value,
                                     'tmdb_show_id', NEW.tmdb_show_id, 'season_number', NEW.season_number, 'episode_number', NEW.episode_number);
      ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.value IS NOT DISTINCT FROM OLD.value THEN RETURN NEW; END IF;
        v_action := 'rating_changed';
        v_body := jsonb_build_object('media_type', NEW.media_type, 'tmdb_id', NEW.tmdb_id, 'value', NEW.value, 'old_value', OLD.value);
      ELSE
        v_action := 'rating_cleared';
        v_body := jsonb_build_object('media_type', OLD.media_type, 'tmdb_id', OLD.tmdb_id, 'value', OLD.value);
      END IF;

    WHEN 'user_rating_history' THEN
      IF TG_OP <> 'DELETE' THEN RETURN NEW; END IF;  -- inserts come from the 039 trigger, already covered by rating_*
      v_user := COALESCE(v_user, OLD.profile_id);
      v_action := 'rating_history_removed';
      v_body := jsonb_build_object('media_type', OLD.media_type, 'tmdb_id', OLD.tmdb_id, 'value', OLD.value, 'changed_at', OLD.changed_at);

    WHEN 'watch_log' THEN
      IF TG_OP = 'INSERT' THEN
        v_user := COALESCE(v_user, NEW.profile_id);
        v_action := 'watch_logged';
        v_body := jsonb_build_object('media_type', NEW.media_type, 'tmdb_id', NEW.tmdb_id, 'watched_at', NEW.watched_at);
      ELSIF TG_OP = 'DELETE' THEN
        v_user := COALESCE(v_user, OLD.profile_id);
        v_action := 'watch_removed';
        v_body := jsonb_build_object('media_type', OLD.media_type, 'tmdb_id', OLD.tmdb_id, 'watched_at', OLD.watched_at);
      ELSE RETURN NEW;
      END IF;

    WHEN 'watchlist' THEN
      IF TG_OP = 'INSERT' THEN
        v_user := COALESCE(v_user, NEW.profile_id);
        v_action := 'watchlist_created';
        v_body := jsonb_build_object('watchlist_id', NEW.id, 'name', NEW.name);
      ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.name IS NOT DISTINCT FROM OLD.name THEN RETURN NEW; END IF;
        v_user := COALESCE(v_user, NEW.profile_id);
        v_action := 'watchlist_renamed';
        v_body := jsonb_build_object('watchlist_id', NEW.id, 'name', NEW.name, 'old_name', OLD.name);
      ELSE
        v_user := COALESCE(v_user, OLD.profile_id);
        v_action := 'watchlist_deleted';
        v_body := jsonb_build_object('watchlist_id', OLD.id, 'name', OLD.name);
      END IF;

    WHEN 'watchlist_item' THEN
      IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;  -- legacy `watched` flag flips are not interesting
      IF TG_OP = 'INSERT' THEN
        v_user := COALESCE(v_user, (SELECT w.profile_id FROM public.watchlist w WHERE w.id = NEW.watchlist_id));
        v_action := 'watchlist_item_added';
        v_body := jsonb_build_object('watchlist_id', NEW.watchlist_id, 'media_type', NEW.media_type, 'tmdb_id', NEW.tmdb_id);
      ELSE
        v_user := COALESCE(v_user, (SELECT w.profile_id FROM public.watchlist w WHERE w.id = OLD.watchlist_id));
        v_action := 'watchlist_item_removed';
        v_body := jsonb_build_object('watchlist_id', OLD.watchlist_id, 'media_type', OLD.media_type, 'tmdb_id', OLD.tmdb_id);
      END IF;

    WHEN 'profile_favourite' THEN
      IF TG_OP = 'DELETE' THEN
        v_user := COALESCE(v_user, OLD.profile_id);
        v_action := 'favourite_cleared';
        v_body := jsonb_build_object('position', OLD.position, 'media_type', OLD.media_type, 'tmdb_id', OLD.tmdb_id);
      ELSE
        v_user := COALESCE(v_user, NEW.profile_id);
        v_action := 'favourite_set';
        v_body := jsonb_build_object('position', NEW.position, 'media_type', NEW.media_type, 'tmdb_id', NEW.tmdb_id);
      END IF;

    WHEN 'user_observe' THEN
      IF TG_OP = 'INSERT' THEN
        v_user := COALESCE(v_user, NEW.observer_id);
        v_target := NEW.observed_id;
        v_action := CASE WHEN NEW.status = 'accepted' THEN 'observe_accepted' ELSE 'observe_requested' END;
        v_body := jsonb_build_object('observer_id', NEW.observer_id, 'observed_id', NEW.observed_id, 'status', NEW.status);
      ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
        v_user := COALESCE(v_user, NEW.observed_id);  -- accepting is the observed user's action
        v_target := NEW.observer_id;
        v_action := CASE WHEN NEW.status = 'accepted' THEN 'observe_accepted' ELSE 'observe_requested' END;
        v_body := jsonb_build_object('observer_id', NEW.observer_id, 'observed_id', NEW.observed_id, 'status', NEW.status, 'old_status', OLD.status);
      ELSE
        v_user := COALESCE(v_user, OLD.observer_id);
        v_target := CASE WHEN v_user = OLD.observer_id THEN OLD.observed_id ELSE OLD.observer_id END;
        v_action := 'observe_removed';
        v_body := jsonb_build_object('observer_id', OLD.observer_id, 'observed_id', OLD.observed_id, 'status', OLD.status);
      END IF;

    WHEN 'user_block' THEN
      IF TG_OP = 'INSERT' THEN
        v_user := COALESCE(v_user, NEW.blocker_id); v_target := NEW.blocked_id;
        v_action := 'user_blocked';
        v_body := jsonb_build_object('blocked_id', NEW.blocked_id);
      ELSIF TG_OP = 'DELETE' THEN
        v_user := COALESCE(v_user, OLD.blocker_id); v_target := OLD.blocked_id;
        v_action := 'user_unblocked';
        v_body := jsonb_build_object('blocked_id', OLD.blocked_id);
      ELSE RETURN NEW;
      END IF;

    WHEN 'user_banner_dismissals' THEN
      IF TG_OP <> 'INSERT' THEN RETURN COALESCE(NEW, OLD); END IF;
      v_user := COALESCE(v_user, NEW.profile_id);
      v_action := 'ea_banner_dismissed';
      v_body := jsonb_build_object('banner_key', NEW.banner_key);

    ELSE
      RETURN COALESCE(NEW, OLD);
  END CASE;

  PERFORM public.audit_write(v_action, v_user, v_method, TG_TABLE_NAME, v_body, v_target);
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_user_rating           ON public.user_rating;
DROP TRIGGER IF EXISTS trg_audit_user_rating_history   ON public.user_rating_history;
DROP TRIGGER IF EXISTS trg_audit_watch_log             ON public.watch_log;
DROP TRIGGER IF EXISTS trg_audit_watchlist             ON public.watchlist;
DROP TRIGGER IF EXISTS trg_audit_watchlist_item        ON public.watchlist_item;
DROP TRIGGER IF EXISTS trg_audit_profile_favourite     ON public.profile_favourite;
DROP TRIGGER IF EXISTS trg_audit_user_observe          ON public.user_observe;
DROP TRIGGER IF EXISTS trg_audit_user_block            ON public.user_block;
DROP TRIGGER IF EXISTS trg_audit_user_banner_dismissals ON public.user_banner_dismissals;

CREATE TRIGGER trg_audit_user_rating            AFTER INSERT OR UPDATE OR DELETE ON public.user_rating            FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_user_rating_history    AFTER DELETE                     ON public.user_rating_history    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_watch_log              AFTER INSERT OR DELETE           ON public.watch_log              FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_watchlist              AFTER INSERT OR UPDATE OR DELETE ON public.watchlist              FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_watchlist_item         AFTER INSERT OR DELETE           ON public.watchlist_item         FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_profile_favourite      AFTER INSERT OR UPDATE OR DELETE ON public.profile_favourite      FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_user_observe           AFTER INSERT OR UPDATE OR DELETE ON public.user_observe           FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_user_block             AFTER INSERT OR DELETE           ON public.user_block             FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_user_banner_dismissals AFTER INSERT                     ON public.user_banner_dismissals FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ───────────────────────────── 3. profile changes, per group ──────────────
CREATE OR REPLACE FUNCTION public.audit_profile_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := COALESCE(auth.uid(), NEW.id);
BEGIN
  IF public.audit_skip() THEN RETURN NEW; END IF;

  -- Soft deletion (delete_account() flips deleted_at; the row stays).
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    PERFORM public.audit_write('account_deleted', NEW.id, 'DELETE', 'profile', '{}'::jsonb);
    RETURN NEW;  -- nothing else about a deleted account is worth logging
  END IF;

  IF NEW.username IS DISTINCT FROM OLD.username THEN
    PERFORM public.audit_write('username_changed', v_user, 'PATCH', 'profile',
      jsonb_build_object('old', OLD.username, 'new', NEW.username), NEW.id);
  END IF;
  IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth OR NEW.is_adult IS DISTINCT FROM OLD.is_adult THEN
    PERFORM public.audit_write('dob_set', v_user, 'PATCH', 'profile',
      jsonb_build_object('is_adult', NEW.is_adult, 'had_dob', OLD.date_of_birth IS NOT NULL), NEW.id);
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    PERFORM public.audit_write('role_changed', v_user, 'PATCH', 'profile',
      jsonb_build_object('old', OLD.role, 'new', NEW.role), NEW.id);
  END IF;
  IF NEW.avatar_type IS DISTINCT FROM OLD.avatar_type
     OR NEW.avatar_poster_tmdb_id IS DISTINCT FROM OLD.avatar_poster_tmdb_id
     OR NEW.avatar_upload_path IS DISTINCT FROM OLD.avatar_upload_path THEN
    PERFORM public.audit_write('avatar_changed', v_user, 'PATCH', 'profile',
      jsonb_build_object('avatar_type', NEW.avatar_type, 'poster_media_type', NEW.avatar_poster_media_type, 'poster_tmdb_id', NEW.avatar_poster_tmdb_id), NEW.id);
  END IF;
  IF NEW.bio IS DISTINCT FROM OLD.bio THEN
    PERFORM public.audit_write('bio_changed', v_user, 'PATCH', 'profile',
      jsonb_build_object('length', length(COALESCE(NEW.bio, ''))), NEW.id);
  END IF;
  IF NEW.banner_favourite_position IS DISTINCT FROM OLD.banner_favourite_position
     OR NEW.banner_crop IS DISTINCT FROM OLD.banner_crop THEN
    PERFORM public.audit_write('banner_changed', v_user, 'PATCH', 'profile',
      jsonb_build_object('position', NEW.banner_favourite_position, 'cropped', NEW.banner_crop IS NOT NULL), NEW.id);
  END IF;
  IF NEW.email_marketing_opt_in IS DISTINCT FROM OLD.email_marketing_opt_in THEN
    PERFORM public.audit_write('marketing_opt_in_changed', v_user, 'PATCH', 'profile',
      jsonb_build_object('opt_in', NEW.email_marketing_opt_in), NEW.id);
  END IF;
  IF NEW.is_private IS DISTINCT FROM OLD.is_private THEN
    PERFORM public.audit_write('privacy_changed', v_user, 'PATCH', 'profile',
      jsonb_build_object('is_private', NEW.is_private), NEW.id);
  END IF;
  IF NEW.setting_allow_profile_share IS DISTINCT FROM OLD.setting_allow_profile_share THEN
    PERFORM public.audit_write('profile_share_toggled', v_user, 'PATCH', 'profile',
      jsonb_build_object('allow', NEW.setting_allow_profile_share), NEW.id);
  END IF;
  IF NEW.setting_display_adult_content IS DISTINCT FROM OLD.setting_display_adult_content THEN
    PERFORM public.audit_write('adult_content_toggled', v_user, 'PATCH', 'profile',
      jsonb_build_object('on', NEW.setting_display_adult_content), NEW.id);
  END IF;
  IF NEW.setting_show_adult_tab IS DISTINCT FROM OLD.setting_show_adult_tab THEN
    PERFORM public.audit_write('adult_tab_toggled', v_user, 'PATCH', 'profile',
      jsonb_build_object('on', NEW.setting_show_adult_tab), NEW.id);
  END IF;
  IF NEW.setting_blur_nsfw_posters IS DISTINCT FROM OLD.setting_blur_nsfw_posters THEN
    PERFORM public.audit_write('nsfw_blur_toggled', v_user, 'PATCH', 'profile',
      jsonb_build_object('on', NEW.setting_blur_nsfw_posters), NEW.id);
  END IF;
  IF NEW.setting_language IS DISTINCT FROM OLD.setting_language
     OR NEW.setting_title_mode IS DISTINCT FROM OLD.setting_title_mode
     OR NEW.setting_region IS DISTINCT FROM OLD.setting_region THEN
    PERFORM public.audit_write('locale_changed', v_user, 'PATCH', 'profile',
      jsonb_build_object('language', NEW.setting_language, 'title_mode', NEW.setting_title_mode, 'region', NEW.setting_region), NEW.id);
  END IF;
  IF NEW.setting_watch_regions IS DISTINCT FROM OLD.setting_watch_regions
     OR NEW.setting_watch_providers IS DISTINCT FROM OLD.setting_watch_providers THEN
    PERFORM public.audit_write('watch_settings_changed', v_user, 'PATCH', 'profile',
      jsonb_build_object('regions', to_jsonb(NEW.setting_watch_regions), 'provider_count', COALESCE(array_length(NEW.setting_watch_providers, 1), 0)), NEW.id);
  END IF;
  IF NEW.setting_home_row_order IS DISTINCT FROM OLD.setting_home_row_order
     OR NEW.setting_home_hidden_rows IS DISTINCT FROM OLD.setting_home_hidden_rows THEN
    PERFORM public.audit_write('home_rows_changed', v_user, 'PATCH', 'profile',
      jsonb_build_object('order', to_jsonb(NEW.setting_home_row_order), 'hidden', to_jsonb(NEW.setting_home_hidden_rows)), NEW.id);
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_profile_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_profile_change ON public.profile;
CREATE TRIGGER trg_audit_profile_change AFTER UPDATE ON public.profile FOR EACH ROW EXECUTE FUNCTION public.audit_profile_change();

-- ───────────────────────────── 4. bulk notification clears ────────────────
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
  SELECT count(*), COALESCE(v_user, min(recipient_id)) INTO v_count, v_user FROM deleted_rows;
  IF v_count > 0 THEN
    PERFORM public.audit_write('notifications_cleared', v_user, 'DELETE', 'notification', jsonb_build_object('count', v_count));
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_notifications_cleared() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_notifications_cleared ON public.notification;
CREATE TRIGGER trg_audit_notifications_cleared
  AFTER DELETE ON public.notification
  REFERENCING OLD TABLE AS deleted_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_notifications_cleared();

-- ───────────────────────────── 6. 024 hygiene ─────────────────────────────
CREATE OR REPLACE FUNCTION public.clean_audit_events_on_profile_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.audit_events WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.clean_audit_events_on_profile_delete() FROM PUBLIC, anon, authenticated;
