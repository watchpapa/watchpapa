import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const TIER_LABELS = {
  free: "Free",
  premium: "Premium",
  pro: "Pro",
  pro_plus: "Pro+",
  god: "God",
};

const TIER_LIMITS = {
  free:    { shows: 3, movies: 1, combined: null },
  premium: { shows: null, movies: null, combined: 10 },
  pro:     { shows: 100, movies: 100, combined: null },
  pro_plus:{ shows: 100, movies: 100, combined: null },
  god:     { shows: null, movies: null, combined: null },
};

export function useSubscription(session) {
  const [data, setData] = useState({
    tier: "free",
    tierLabel: "Free",
    limits: TIER_LIMITS.free,
    referralCode: null,
    isEarlyAdopter: false,
    expiresAt: null,
    loginDayCount: 0,
    isLoading: true,
  });

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setData((d) => ({ ...d, isLoading: false }));
      return;
    }

    const uid = session.user.id;

    const [profileRes, subRes, referralRes, tierRes] = await Promise.all([
      supabase.from("profile").select("referral_code").eq("id", uid).maybeSingle(),
      supabase.from("user_subscriptions")
        .select("tier, expires_at, is_early_adopter")
        .eq("profile_id", uid)
        .maybeSingle(),
      supabase.from("referrals")
        .select("login_day_count")
        .eq("referred_id", uid)
        .eq("status", "pending")
        .maybeSingle(),
      supabase.rpc("get_effective_tier", { p_profile_id: uid }),
    ]);

    const tier = tierRes.data ?? "free";

    setData({
      tier,
      tierLabel: TIER_LABELS[tier] ?? tier,
      limits: TIER_LIMITS[tier] ?? TIER_LIMITS.free,
      referralCode: profileRes.data?.referral_code ?? null,
      isEarlyAdopter: subRes.data?.is_early_adopter ?? false,
      expiresAt: subRes.data?.expires_at ?? null,
      loginDayCount: referralRes.data?.login_day_count ?? 0,
      isLoading: false,
    });

    // Fire record_login_day once per session load — safe to call on every load.
    if (referralRes.data) {
      supabase.rpc("record_login_day", { p_profile_id: uid }).then(() => {});
    }
  }, [session?.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...data, reload: load };
}
