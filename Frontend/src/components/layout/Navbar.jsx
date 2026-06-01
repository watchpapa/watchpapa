import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import AuthPromptModal from "../AuthPromptModal.jsx";
import ProfileMenu from "./ProfileMenu.jsx";
import NotificationBell from "./NotificationBell.jsx";
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  );
}

function FindPeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <circle cx="18" cy="8" r="3" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function WatchlistNavIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const SESSION_ACTIONS = [
  { label: "Find People", to: "/users", Icon: FindPeopleIcon },
  { label: "Activity", to: "/feed", Icon: ActivityIcon },
  { label: "Watchlists", to: "/watchlists", Icon: WatchlistNavIcon },
  { label: "Releases Radar", to: "/calendar", Icon: CalendarIcon },
];

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// Compact header control — icon-only to avoid crowding the bar.
function NavIconLink({ to, label, children, onClick }) {
  const className =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8888c8] transition hover:bg-[#1a1d35] hover:text-white";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} title={label} aria-label={label}>
        {children}
      </button>
    );
  }
  return (
    <Link to={to} className={className} title={label} aria-label={label}>
      {children}
    </Link>
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
      <header ref={headerRef} className="sticky top-0 z-50 border-b border-[#2a3570]/40 bg-[#0d0f1e]/80 backdrop-blur-md">
        {/* Three-column grid keeps the logo centered without overlapping nav/actions */}
        <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 sm:px-5 lg:px-8">
          {/* Left: menu + catalog links */}
          <div className="flex min-w-0 items-center gap-1">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8888c8] transition hover:bg-[#1a1d35] hover:text-white sm:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <XIcon /> : <MenuIcon />}
            </button>

            <nav className="hidden min-w-0 items-center gap-3 md:gap-4 sm:flex">
              {NAV_LINKS.map(({ label, to }) => (
                <NavLink
                  key={label}
                  to={to}
                  end
                  className={({ isActive }) =>
                    `whitespace-nowrap text-sm font-semibold tracking-wide transition-colors ${
                      isActive ? "text-white" : "text-[#8888c8] hover:text-white"
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Center: logo */}
          <Link to="/" className="shrink-0 justify-self-center">
            <img
              src={watchpapaBanner}
              alt="watchpapa"
              className="h-7 w-auto drop-shadow-md sm:h-8"
            />
          </Link>

          {/* Right: session tools + auth */}
          <div className="flex min-w-0 items-center justify-end gap-0.5 sm:gap-1">
            {session && (
              <div className="hidden items-center sm:flex">
                {SESSION_ACTIONS.map(({ label, to, Icon }) => (
                  <NavIconLink key={to} to={to} label={label}>
                    <Icon />
                  </NavIconLink>
                ))}
              </div>
            )}

            {!session && (
              <div className="hidden sm:block">
                <NavIconLink label="Releases Radar" onClick={() => setShowAuthPrompt(true)}>
                  <CalendarIcon />
                </NavIconLink>
              </div>
            )}

            {session && <NotificationBell session={session} />}

            {session ? (
              <ProfileMenu session={session} />
            ) : (
              <div className="ml-1 flex items-center gap-1 sm:gap-1.5">
                <Link
                  to="/login"
                  className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#8888c8] transition hover:text-white sm:px-3"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl border border-[#6f6fdc] bg-gradient-to-b from-[#6f6fdc] to-[#4b3bb0] px-2.5 py-1.5 text-xs font-semibold text-white shadow-[0_4px_14px_-6px_rgba(111,111,220,0.8)] transition hover:from-[#8585ef] hover:to-[#6f6fdc] sm:px-3"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="border-t border-[#2a3570]/50 px-5 pb-3 sm:hidden animate-[slideDown_0.18s_ease-out]">
            {session &&
              SESSION_ACTIONS.map(({ label, to, Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 border-b border-[#2a3570]/50 py-3 text-sm font-semibold text-[#8888c8] transition hover:text-white"
                >
                  <Icon />
                  {label}
                </Link>
              ))}

            {NAV_LINKS.map(({ label, to }) => (
              <NavLink
                key={label}
                to={to}
                end
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block border-b border-[#2a3570]/50 py-3 text-sm font-semibold transition last:border-0 ${
                    isActive ? "text-white" : "text-[#8888c8]"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}

            {!session && (
              <>
                <button
                  type="button"
                  onClick={() => { setMobileOpen(false); setShowAuthPrompt(true); }}
                  className="flex w-full items-center gap-2 border-b border-[#2a3570]/50 py-3 text-sm font-semibold text-[#8888c8]"
                >
                  <CalendarIcon />
                  Releases Radar
                </button>
                <div className="flex gap-2 pt-3">
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 rounded-xl border border-[#3a3a7a] py-2.5 text-center text-sm font-semibold text-[#a0a0e8]"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 rounded-xl border border-[#6f6fdc] bg-gradient-to-b from-[#6f6fdc] to-[#4b3bb0] py-2.5 text-center text-sm font-semibold text-white"
                  >
                    Register
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </header>
    </>
  );
}

export default Navbar;
