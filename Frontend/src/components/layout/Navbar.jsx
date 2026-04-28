import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import AuthPromptModal from "../AuthPromptModal.jsx";
import ProfileMenu from "./ProfileMenu.jsx";
import watchpapaBanner from "../../assets/branding/watchpapa-banner.svg";

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

          {/* Right: calendar + auth */}
          <div className="flex items-center gap-2 sm:gap-3">
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
