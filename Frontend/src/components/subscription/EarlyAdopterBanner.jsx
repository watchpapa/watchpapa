import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import IconButton from "../ui/IconButton.jsx";
import { StarIcon, XIcon } from "../icons/index.jsx";

const BANNER_KEY = "early_adopter";
const STORAGE_KEY = `watchpapa:banner_dismissed:${BANNER_KEY}`;

// One-line thank-you strip for early adopters; dismissible (persisted per
// account and cached per device). Compact on phones.
function EarlyAdopterBanner({ session }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    Promise.all([
      supabase.from("user_subscriptions").select("is_early_adopter").eq("profile_id", session.user.id).maybeSingle(),
      supabase.from("user_banner_dismissals").select("banner_key").eq("profile_id", session.user.id).eq("banner_key", BANNER_KEY).maybeSingle(),
    ]).then(([{ data: sub }, { data: dismissal }]) => {
      if (dismissal) localStorage.setItem(STORAGE_KEY, "1");
      else if (sub?.is_early_adopter) setVisible(true);
    });
  }, [session?.user?.id]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    supabase.rpc("dismiss_banner", { p_banner_key: BANNER_KEY }).then(() => {});
  };

  if (!visible) return null;

  return (
    <div className="relative overflow-hidden border-b border-amber-700/60" style={{ background: "linear-gradient(135deg, #3d1c00 0%, #1f0d00 40%, #2a1500 100%)" }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 120% at 50% -20%, rgba(251,191,36,0.18) 0%, transparent 70%)" }} />
      <div className="relative mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3 lg:px-8 3xl:max-w-[1920px]">
        <span className="hidden shrink-0 items-center gap-0.5 text-amber-400 sm:flex" aria-hidden>
          <StarIcon size={16} fill="currentColor" /><StarIcon size={16} fill="currentColor" /><StarIcon size={16} fill="currentColor" />
        </span>
        <StarIcon size={18} fill="currentColor" className="shrink-0 text-amber-400 sm:hidden" aria-hidden />
        <p className="min-w-0 flex-1 text-xs leading-snug text-amber-200/85 sm:text-sm">
          <strong className="font-bold text-amber-300">You're an Early Adopter</strong>
          <span className="hidden sm:inline"> — thank you for joining early. You have </span>
          <span className="sm:hidden"> · </span>
          <strong className="font-semibold text-amber-300">lifetime Premium</strong>
          <span className="hidden sm:inline">, already active.</span>{" "}
          <Link to="/subscription" className="underline decoration-amber-500/60 underline-offset-2 transition hover:text-amber-100">See what's included</Link>
        </p>
        <IconButton label="Dismiss early adopter banner" size="sm" onClick={dismiss} className="shrink-0 text-amber-500 hover:bg-amber-900/40 hover:text-amber-200">
          <XIcon size={16} />
        </IconButton>
      </div>
    </div>
  );
}

export default EarlyAdopterBanner;
