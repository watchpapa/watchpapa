import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// The profile row + blocked list + subscription expiry the Settings sections
// share. Tier / early-adopter come from CurrentUserContext instead.
// `loading` starts true and only ever flips to false — a reload keeps the
// current data on screen instead of flashing the skeleton.
export function useSettingsData(session) {
  const uid = session?.user?.id;
  const [profile, setProfile] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!uid) return Promise.resolve();
    return Promise.all([
      supabase
        .from("profile")
        .select("username, is_adult, is_private, date_of_birth, setting_display_adult_content, setting_allow_profile_share, email_marketing_opt_in, referral_code, username_changed_at")
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("user_subscriptions").select("is_early_adopter, expires_at").eq("profile_id", uid).maybeSingle(),
      supabase.from("user_block").select("blocked_id, created_at, blocked:blocked_id(id, username)").eq("blocker_id", uid).order("created_at", { ascending: false }),
    ]).then(([profileRes, subRes, blockedRes]) => {
      setProfile(profileRes.data ?? null);
      setExpiresAt(subRes.data?.expires_at ?? null);
      setBlocked(blockedRes.data ?? []);
      setLoading(false);
    });
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  return { uid, profile, setProfile, blocked, setBlocked, expiresAt, loading, reload: load };
}
