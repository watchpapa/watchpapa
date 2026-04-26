import { Link, NavLink } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useNavigate } from "react-router-dom";

const NAV_LINKS = [
  { label: "Popular", to: "/" },
  { label: "Movies", to: "/movies" },
  { label: "Shows", to: "/shows" },
  { label: "People", to: "/people" },
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

function Navbar({ session }) {
  const navigate = useNavigate();

  const onSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const avatarUrl = session?.user?.user_metadata?.avatar_url;
  const initials = (session?.user?.email?.[0] ?? "?").toUpperCase();

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-4 border-b border-[#1a1f3a] bg-[#0d0f1e]/95 px-5 backdrop-blur-sm lg:px-8">
      <nav className="flex items-center gap-5">
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

      <Link
        to="/"
        className="absolute left-1/2 -translate-x-1/2 text-2xl font-extrabold tracking-tight"
        style={{ background: "linear-gradient(90deg, #ff80b5 0%, #9089fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
      >
        watchpapa
      </Link>

      <div className="flex items-center gap-3">
        <Link
          to="/calendar"
          className="hidden items-center gap-2 rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white sm:flex"
        >
          <CalendarIcon />
          Your Releases Calendar
        </Link>

        <button
          onClick={onSignOut}
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-[#3a3a7a] bg-[#1a1d35] text-sm font-bold text-[#a0a0e8] transition hover:border-[#7070d0]"
          title="Sign out"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </button>
      </div>
    </header>
  );
}

export default Navbar;
