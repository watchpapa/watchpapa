import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import AuthPromptModal from "../AuthPromptModal.jsx";
import ProfileMenu from "./ProfileMenu.jsx";
import watchpapaBanner from "../../assets/branding/watchpapa-banner.svg";
import { supabase } from "../../lib/supabase.js";

const NAV_LINKS = [
  { label: "Popular", to: "/" },
  { label: "Movies", to: "/movies" },
  { label: "Shows", to: "/shows" },
  { label: "People", to: "/people" },
  { label: "Search", to: "/search" },
];

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function ReferralIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function ReferralButton({ session }) {
  const [open, setOpen] = useState(false);
  const [referralCode, setReferralCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("profile")
      .select("referral_code")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => { if (data?.referral_code) setReferralCode(data.referral_code); });
  }, [session?.user?.id]);

  useEffect(() => {
    function onPointerdown(e) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("pointerdown", onPointerdown);
    return () => document.removeEventListener("pointerdown", onPointerdown);
  }, [open]);

  const referralUrl = referralCode
    ? `${window.location.origin}/register?ref=${referralCode}`
    : null;

  const handleCopy = () => {
    if (!referralUrl) return;
    navigator.clipboard?.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (!referralUrl) return;
    navigator.share?.({ title: "Join watchpapa", url: referralUrl });
  };

  return (
    <div className="relative hidden sm:block">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
          open
            ? "border-[#5a5aaa] bg-[#1a1d35] text-white"
            : "border-[#3a3a7a] bg-[#1a1d35] text-[#a0a0e8] hover:border-[#5a5aaa] hover:text-white"
        }`}
        aria-label="Invite friends"
      >
        <ReferralIcon />
        <span className="hidden lg:inline">Invite Friends</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#2a2f5a] bg-[#0d0f1e] shadow-2xl shadow-black/60"
        >
          <div className="border-b border-[#1a1f3a] px-4 py-3">
            <p className="text-sm font-bold text-white">Invite a friend</p>
            <p className="mt-0.5 text-xs text-[#6868b8]">Share your link — you both get rewarded.</p>
          </div>

          <div className="px-4 py-3">
            {referralUrl ? (
              <>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#5050b0]">Your referral link</p>
                <div className="flex items-center gap-1.5 rounded-xl border border-[#2a3570] bg-[#141728] px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#a0a0e8]">
                    {referralUrl}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={handleCopy}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#8383e7] transition hover:bg-[#2a2d60] hover:text-white"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    {typeof navigator !== "undefined" && navigator.share && (
                      <button
                        onClick={handleShare}
                        className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#8383e7] transition hover:bg-[#2a2d60] hover:text-white"
                      >
                        Share
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#4a4a7a]">Loading your referral link…</p>
            )}
          </div>

          <div className="border-t border-[#1a1f3a] px-4 py-3">
            <p className="text-[11px] text-[#4a4a7a]">
              You and your friend both unlock a plan upgrade when they join and get active.{" "}
              <Link to="/subscription" onClick={() => setOpen(false)} className="text-[#6868b8] hover:text-[#a0a0e8]">
                See details
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Navbar({ session }) {
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => {
    function onPointerdown(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    }
    if (mobileOpen) document.addEventListener("pointerdown", onPointerdown);
    return () => document.removeEventListener("pointerdown", onPointerdown);
  }, [mobileOpen]);

  return (
    <>
      {showAuthPrompt && <AuthPromptModal onClose={() => setShowAuthPrompt(false)} />}
      <header ref={headerRef} className="sticky top-0 z-50 border-b border-[#1a1f3a] bg-[#0d0f1e]/95 backdrop-blur-sm">
        <div className="relative flex min-h-14 items-center justify-between gap-3 px-3 py-2 sm:gap-4 sm:px-5 sm:py-0 lg:px-8">

          {/* Left: hamburger (mobile) or nav links (sm+) */}
          <div className="flex items-center">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8888c8] transition hover:text-white sm:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <XIcon /> : <MenuIcon />}
            </button>

            <nav className="hidden items-center gap-5 sm:flex">
              {NAV_LINKS.map(({ label, to }) => (
                <NavLink
                  key={label}
                  to={to}
                  end
                  className={({ isActive }) =>
                    `text-sm font-semibold tracking-wide transition-colors ${
                      isActive ? "text-white" : "text-[#8888c8] hover:text-white"
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Center: Logo */}
          <Link to="/" className="mx-auto sm:absolute sm:left-1/2 sm:mx-0 sm:-translate-x-1/2">
            <img src={watchpapaBanner} alt="watchpapa" className="h-9 drop-shadow-md" />
          </Link>

          {/* Right: invite + calendar + auth */}
          <div className="flex items-center gap-2 sm:gap-3">
            {session && <ReferralButton session={session} />}

            {session ? (
              <Link
                to="/calendar"
                className="hidden items-center gap-2 rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white sm:flex"
              >
                <CalendarIcon />
                <span className="hidden lg:inline">Your Releases Calendar</span>
                <span className="inline lg:hidden">Calendar</span>
              </Link>
            ) : (
              <button
                onClick={() => setShowAuthPrompt(true)}
                className="hidden items-center gap-2 rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white sm:flex"
              >
                <CalendarIcon />
                <span className="hidden lg:inline">Your Releases Calendar</span>
                <span className="inline lg:hidden">Calendar</span>
              </button>
            )}

            {session ? (
              <ProfileMenu session={session} />
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  to="/login"
                  className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#8888c8] transition hover:text-white sm:px-3"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-2.5 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white sm:px-3"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="border-t border-[#1a1f3a] px-5 pb-2 sm:hidden">
            {NAV_LINKS.map(({ label, to }) => (
              <NavLink
                key={label}
                to={to}
                end
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block border-b border-[#1a1f3a] py-3 text-sm font-semibold transition last:border-0 ${
                    isActive ? "text-white" : "text-[#8888c8]"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            {session ? (
              <Link
                to="/calendar"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 py-3 text-sm font-semibold text-[#8888c8] transition hover:text-white"
              >
                <CalendarIcon />
                Your Releases Calendar
              </Link>
            ) : null}
          </div>
        )}
      </header>
    </>
  );
}

export default Navbar;
