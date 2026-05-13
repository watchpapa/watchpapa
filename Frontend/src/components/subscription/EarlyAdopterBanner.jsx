import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";

const STORAGE_KEY = "watchpapa:ea_banner_dismissed";

function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function EarlyAdopterBanner({ session }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    supabase
      .from("user_subscriptions")
      .select("is_early_adopter")
      .eq("profile_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.is_early_adopter) setVisible(true);
      });
  }, [session?.user?.id]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="relative overflow-hidden border-b border-amber-700/60"
      style={{ background: "linear-gradient(135deg, #3d1c00 0%, #1f0d00 40%, #2a1500 100%)" }}
    >
      {/* Decorative glow */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 120% at 50% -20%, rgba(251,191,36,0.18) 0%, transparent 70%)" }} />

      <div className="relative mx-auto flex max-w-[1588px] items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        {/* Icon cluster */}
        <div className="flex shrink-0 items-center gap-1 text-amber-400">
          <StarIcon />
          <StarIcon />
          <StarIcon />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-300 sm:text-base">
            You're an Early Adopter!
          </p>
          <p className="mt-0.5 text-xs text-amber-200/80 sm:text-sm">
            Thank you for joining watchpapa early. You've been awarded{" "}
            <strong className="font-semibold text-amber-300">lifetime Premium</strong> — no action needed, it's already active.{" "}
            <Link
              to="/subscription"
              className="underline decoration-amber-500/60 underline-offset-2 transition hover:text-amber-100"
            >
              See what's included
            </Link>
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          aria-label="Dismiss early adopter banner"
          className="shrink-0 rounded-lg p-1.5 text-amber-500 transition hover:bg-amber-900/40 hover:text-amber-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default EarlyAdopterBanner;
