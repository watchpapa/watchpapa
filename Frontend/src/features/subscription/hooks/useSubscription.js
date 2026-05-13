import { useCallback, useEffect, useRef, useState } from "react";
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

function deriveTier(sub) {
  if (!sub) return "free";
  if (sub.tier === "god") return "god";
  if (!sub.expires_at || new Date(sub.expires_at) > new Date()) return sub.tier;
  return sub.is_early_adopter ? "premium" : "free";
}

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

  const uid = session?.user?.id ?? null;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!uid) {
      setData((d) => ({ ...d, isLoading: false }));
      return;
    }

    // Fetch subscription data first — it's the most important for tier display.
    let sub = null;
    try {
      const { data: subData, error: subErr } = await supabase
        .from("user_subscriptions")
        .select("tier, expires_at, is_early_adopter")
        .eq("profile_id", uid)
        .maybeSingle();
      if (!subErr) sub = subData;
    } catch (_) {}

    const tier = deriveTier(sub);

    if (mountedRef.current) {
      setData((d) => ({
        ...d,
        tier,
        tierLabel: TIER_LABELS[tier] ?? tier,
        limits: TIER_LIMITS[tier] ?? TIER_LIMITS.free,
        isEarlyAdopter: sub?.is_early_adopter ?? false,
        expiresAt: sub?.expires_at ?? null,
        isLoading: false,
      }));
    }

    // Load referral code and login tracking separately — don't block tier display.
    try {
      const [profileRes, referralRes] = await Promise.all([
        supabase.from("profile").select("referral_code").eq("id", uid).maybeSingle(),
        supabase.from("referrals")
          .select("login_day_count")
          .eq("referred_id", uid)
          .eq("status", "pending")
          .maybeSingle(),
      ]);

      if (mountedRef.current) {
        setData((d) => ({
          ...d,
          referralCode: profileRes.data?.referral_code ?? d.referralCode,
          loginDayCount: referralRes.data?.login_day_count ?? d.loginDayCount,
        }));
      }

      if (referralRes.data) {
        supabase.rpc("record_login_day", { p_profile_id: uid }).then(() => {});
      }
    } catch (_) {}
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...data, reload: load };
}
