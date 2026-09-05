-- 046_bottom_tab_middle_preference — which control shows in the phone bottom
-- tab bar's middle slot. My Services requires Pro, so the value only takes
-- effect for Pro+ accounts; everyone else always sees Search regardless of
-- what's stored here (enforced client-side, not by this column).

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS setting_bottom_tab_middle TEXT NOT NULL DEFAULT 'services'
    CHECK (setting_bottom_tab_middle IN ('search', 'services'));

-- Extend migration 044's per-changed-group profile audit trigger to cover it.
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
  IF NEW.setting_bottom_tab_middle IS DISTINCT FROM OLD.setting_bottom_tab_middle THEN
    PERFORM public.audit_write('bottom_tab_preference_changed', v_user, 'PATCH', 'profile',
      jsonb_build_object('middle', NEW.setting_bottom_tab_middle), NEW.id);
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_profile_change() FROM PUBLIC, anon, authenticated;
