import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";

const TIER_COLORS = {
  free:     "text-green-400",
  premium:  "text-amber-400",
  pro:      "text-sky-400",
  pro_plus: "text-violet-400",
  god:      "text-rose-400",
};

const TIER_LABELS = {
  free: "Free", premium: "Premium", pro: "Pro", pro_plus: "Pro+", god: "God",
};

function ProfileMenu({ session }) {
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState("free");
  const [isEarlyAdopter, setIsEarlyAdopter] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const usernameForInitials = (session?.user?.user_metadata?.username ?? session?.user?.email ?? "").trim();
  const initials = (usernameForInitials[0] ?? "?").toUpperCase();
  const displayName = session?.user?.user_metadata?.username ?? session?.user?.email ?? "—";

  useEffect(() => {
    if (!open || !session?.user?.id) return;
    let active = true;
    Promise.all([
      supabase.rpc("get_effective_tier", { p_profile_id: session.user.id }),
      supabase.from("user_subscriptions").select("is_early_adopter").eq("profile_id", session.user.id).maybeSingle(),
      supabase.from("profile").select("role").eq("id", session.user.id).single(),
    ]).then(([tierRes, subRes, profileRes]) => {
      if (!active) return;
      setTier(tierRes.data ?? "free");
      setIsEarlyAdopter(subRes.data?.is_early_adopter ?? false);
      setIsAdmin(profileRes.data?.role === 4);
    });
    return () => { active = false; };
  }, [open, session?.user?.id]);

  useEffect(() => {
    function handleMousedown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleMousedown);
    return () => document.removeEventListener("mousedown", handleMousedown);
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await supabase.auth.signOut();
  };

  if (!session) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-[#3a3a7a] bg-[#1a1d35] text-sm font-bold text-[#a0a0e8] transition hover:border-[#7070d0]"
        aria-label="Profile menu"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 origin-top-right animate-[fadeSlideDown_0.15s_ease-out] rounded-2xl border border-[#2a3570] bg-[#0d0f1e] shadow-xl shadow-black/40">
          <div className="px-4 py-3 border-b border-[#1a1f3a]">
            <p className="text-sm font-bold text-white truncate">{displayName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`text-xs font-semibold ${TIER_COLORS[tier] ?? "text-[#6868b8]"}`}>
                {TIER_LABELS[tier] ?? tier}
              </span>
              {isEarlyAdopter && (
                <span className="rounded border border-amber-700/50 bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                  Early Adopter
                </span>
              )}
            </div>
          </div>

          <div className="p-2 space-y-0.5">
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#8383e7] transition hover:bg-[#141728] hover:text-[#a0a0f7]"
              >
                <AdminIcon />
                Admin panel
              </Link>
            )}
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#c0c0e8] transition hover:bg-[#141728] hover:text-white"
            >
              <SettingsIcon />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#c0c0e8] transition hover:bg-[#141728] hover:text-white"
            >
              <SignOutIcon />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default ProfileMenu;
