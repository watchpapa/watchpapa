import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { PROFILE_UPDATED_EVENT } from "./profileEvents.js";

// One fetch for everything the chrome needs to know about the signed-in user
// (role, tier, avatar, referral code, unread/pending counts). Replaces the
// three separate `profile.role` queries (AdminRoute, useIsAdmin, the old
// ProfileMenu) and the lazy per-open tier/referral fetch the dropdown did.
//
// `initialProfile` is the row App.jsx already fetched at boot, so mounting the
// provider costs no extra profile round-trip; tier/EA/counts are fetched once
// here. Components that change the profile call notifyProfileUpdated() (see
// profileEvents.js) and the provider refetches, so the header updates live.

const PROFILE_COLUMNS =
  "username, role, avatar_type, avatar_poster_path, avatar_upload_path, referral_code, is_private";

const CurrentUserContext = createContext(null);

function shapeProfile(row) {
  if (!row) return null;
  return {
    username: row.username?.trim() ?? "",
    role: typeof row.role === "number" ? row.role : Number(row.role ?? 0),
    avatarType: row.avatar_type ?? "default",
    avatarPosterPath: row.avatar_poster_path ?? null,
    avatarUploadPath: row.avatar_upload_path ?? null,
    referralCode: row.referral_code ?? null,
    isPrivate: row.is_private ?? false,
  };
}

const EMPTY_AVATAR = { type: "default", posterPath: null, uploadPath: null };

export function CurrentUserProvider({ session, initialProfile = null, children }) {
  const uid = session?.user?.id ?? null;
  const location = useLocation();
  const [profile, setProfile] = useState(() => shapeProfile(initialProfile));
  const [tier, setTier] = useState("free");
  const [isEarlyAdopter, setIsEarlyAdopter] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [booted, setBooted] = useState(!!initialProfile);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase.from("profile").select(PROFILE_COLUMNS).eq("id", uid).maybeSingle();
    if (alive.current && data) setProfile(shapeProfile(data));
  }, [uid]);

  const refreshTier = useCallback(async () => {
    if (!uid) return;
    const [tierRes, subRes] = await Promise.all([
      supabase.rpc("get_effective_tier", { p_profile_id: uid }),
      supabase.from("user_subscriptions").select("is_early_adopter").eq("profile_id", uid).maybeSingle(),
    ]);
    if (!alive.current) return;
    setTier(tierRes.data ?? "free");
    setIsEarlyAdopter(subRes.data?.is_early_adopter ?? false);
  }, [uid]);

  const refreshCounts = useCallback(async () => {
    if (!uid) return;
    const [unreadRes, pendingRes] = await Promise.all([
      supabase.rpc("get_unread_notification_count"),
      supabase
        .from("user_observe")
        .select("observer_id", { count: "exact", head: true })
        .eq("observed_id", uid)
        .eq("status", "pending"),
    ]);
    if (!alive.current) return;
    setUnreadNotifications(unreadRes.data ?? 0);
    setPendingRequests(pendingRes.count ?? 0);
  }, [uid]);

  // Boot: profile (only if App didn't hand us one), then tier + counts.
  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    (async () => {
      if (!initialProfile) await refreshProfile();
      await Promise.all([refreshTier(), refreshCounts()]);
      if (!cancelled && alive.current) setBooted(true);
    })();
    return () => { cancelled = true; };
    // initialProfile is a boot-time snapshot; re-running on it would just refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, refreshProfile, refreshTier, refreshCounts]);

  // Counts are cheap — refresh on every route change so badges stay honest
  // without polling.
  useEffect(() => {
    refreshCounts();
  }, [location.pathname, refreshCounts]);

  // Profile edits (avatar, username, bio…) announce themselves.
  useEffect(() => {
    const onUpdated = () => { refreshProfile(); refreshTier(); };
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdated);
  }, [refreshProfile, refreshTier]);

  const value = useMemo(() => {
    // Signed out: expose the anonymous shape regardless of any stale state.
    if (!uid) return { ...ANON, refreshCounts };
    const username = profile?.username || session?.user?.user_metadata?.username || "";
    const role = profile?.role ?? 0;
    return {
      session,
      userId: uid,
      isAuthenticated: true,
      loading: !booted && !profile,
      profile,
      username,
      role,
      isAdmin: role === 4,
      isEditor: role === 3 || role === 4,
      tier,
      isEarlyAdopter,
      avatar: profile
        ? { type: profile.avatarType, posterPath: profile.avatarPosterPath, uploadPath: profile.avatarUploadPath }
        : EMPTY_AVATAR,
      referralCode: profile?.referralCode ?? null,
      referralUrl:
        profile?.referralCode && typeof window !== "undefined"
          ? `${window.location.origin}/register?ref=${profile.referralCode}`
          : null,
      unreadNotifications,
      setUnreadNotifications,
      pendingRequests,
      refresh: async () => { await Promise.all([refreshProfile(), refreshTier(), refreshCounts()]); },
      refreshCounts,
    };
  }, [session, uid, booted, profile, tier, isEarlyAdopter, unreadNotifications, pendingRequests, refreshProfile, refreshTier, refreshCounts]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

const ANON = {
  session: null, userId: null, isAuthenticated: false, loading: false, profile: null, username: "",
  role: 0, isAdmin: false, isEditor: false, tier: "free", isEarlyAdopter: false,
  avatar: EMPTY_AVATAR, referralCode: null, referralUrl: null,
  unreadNotifications: 0, setUnreadNotifications: () => {}, pendingRequests: 0,
  refresh: async () => {}, refreshCounts: async () => {},
};

// Safe outside the provider (auth pages) — returns the anonymous shape.
// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentUser() {
  return useContext(CurrentUserContext) ?? ANON;
}
