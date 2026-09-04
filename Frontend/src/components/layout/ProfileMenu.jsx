import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import Avatar from "../ui/Avatar.jsx";

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

// True when the device has no hover capability (touch-only).
const isTouchDevice = () => !window.matchMedia("(hover: hover)").matches;

function ProfileMenu({ session }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const closeTimer = useRef(null);
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState("free");
  const [isEarlyAdopter, setIsEarlyAdopter] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [referralCode, setReferralCode] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [avatar, setAvatar] = useState({ type: "default", posterPath: null, uploadPath: null });

  const username = (session?.user?.user_metadata?.username ?? session?.user?.email ?? "").trim();
  const displayName = username || "—";

  // Avatar is shown on the closed button too, so it's fetched eagerly (not
  // gated behind `open` like the rest of this dropdown's data).
  useEffect(() => {
    if (!session?.user?.id) return;
    let active = true;
    supabase
      .from("profile")
      .select("avatar_type, avatar_poster_path, avatar_upload_path")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setAvatar({ type: data.avatar_type ?? "default", posterPath: data.avatar_poster_path ?? null, uploadPath: data.avatar_upload_path ?? null });
      });
    return () => { active = false; };
  }, [session?.user?.id]);

  // Fetch tier/admin info lazily when dropdown opens.
  useEffect(() => {
    if (!open || !session?.user?.id) return;
    let active = true;
    Promise.all([
      supabase.rpc("get_effective_tier", { p_profile_id: session.user.id }),
      supabase.from("user_subscriptions").select("is_early_adopter").eq("profile_id", session.user.id).maybeSingle(),
      supabase.from("profile").select("role, referral_code").eq("id", session.user.id).single(),
    ]).then(([tierRes, subRes, profileRes]) => {
      if (!active) return;
      setTier(tierRes.data ?? "free");
      setIsEarlyAdopter(subRes.data?.is_early_adopter ?? false);
      setIsAdmin(profileRes.data?.role === 4);
      setReferralCode(profileRes.data?.referral_code ?? null);
    });
    return () => { active = false; };
  }, [open, session?.user?.id]);

  // Close on outside click (mobile / keyboard navigation).
  useEffect(() => {
    function onPointerdown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("pointerdown", onPointerdown);
    return () => document.removeEventListener("pointerdown", onPointerdown);
  }, [open]);

  const handleMouseEnter = () => {
    if (isTouchDevice()) return;
    clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (isTouchDevice()) return;
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  // Desktop: click navigates to profile. Mobile: click toggles dropdown.
  const handleButtonClick = () => {
    if (isTouchDevice()) {
      setOpen((v) => !v);
    } else {
      navigate(`/u/${username}`);
    }
  };

  const handleSignOut = async () => {
    setOpen(false);
    await supabase.auth.signOut();
  };

  const referralUrl = referralCode
    ? `${window.location.origin}/register?ref=${referralCode}`
    : null;

  const handleCopyReferral = () => {
    if (!referralUrl) return;
    navigator.clipboard?.writeText(referralUrl).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  };

  const handleShareReferral = () => {
    if (!referralUrl) return;
    navigator.share?.({ title: "Join watchpapa", url: referralUrl });
  };

  if (!session) return null;

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleButtonClick}
        className="rounded-full transition hover:ring-2 hover:ring-[#7070d0]"
        aria-label="Profile menu"
      >
        <Avatar
          username={username}
          avatarType={avatar.type}
          avatarPosterPath={avatar.posterPath}
          avatarUploadPath={avatar.uploadPath}
          size="sm"
        />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 max-w-[calc(100vw-1rem)] origin-top-right animate-[fadeSlideDown_0.15s_ease-out] rounded-2xl border border-[#2a3570] bg-[#0d0f1e] shadow-xl shadow-black/40">
          {/* User info header */}
          <div className="px-4 py-3 border-b border-[#2a3570]/50">
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

          <div className="border-b border-[#2a3570]/50 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <ReferralIcon />
              Invite Friends
            </p>
            <p className="mt-0.5 text-xs text-[#6868b8]">Share your link — you both get rewarded.</p>
            {referralUrl ? (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-[#2a3570] bg-[#141728] px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#a0a0e8]">
                  {referralUrl}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#8383e7] transition hover:bg-[#2a2d60] hover:text-white"
                  >
                    {inviteCopied ? "Copied!" : "Copy"}
                  </button>
                  {typeof navigator !== "undefined" && navigator.share && (
                    <button
                      type="button"
                      onClick={handleShareReferral}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#8383e7] transition hover:bg-[#2a2d60] hover:text-white"
                    >
                      Share
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-[#4a4a7a]">Loading your referral link…</p>
            )}
            <p className="mt-2 text-[11px] text-[#4a4a7a]">
              <Link to="/subscription" onClick={() => setOpen(false)} className="text-[#6868b8] hover:text-[#a0a0e8]">
                See reward details
              </Link>
            </p>
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
              to={`/u/${username}`}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#c0c0e8] transition hover:bg-[#141728] hover:text-white"
            >
              <ProfileIcon />
              My Profile
            </Link>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#c0c0e8] transition hover:bg-[#141728] hover:text-white"
            >
              <BellIcon />
              Notifications
            </Link>
            <Link
              to="/observe-requests"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#c0c0e8] transition hover:bg-[#141728] hover:text-white"
            >
              <RequestIcon />
              Observe Requests
            </Link>
            <Link
              to="/profile/edit"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#c0c0e8] transition hover:bg-[#141728] hover:text-white"
            >
              <EditIcon />
              Edit Profile
            </Link>
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

function ReferralIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function RequestIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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
