import { useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cn } from "../../lib/cn.js";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import { useEscapeKey } from "../../hooks/useEscapeKey.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import watchpapaBanner from "../../assets/branding/watchpapa-banner.svg";
import SearchBar from "../home/SearchBar.jsx";
import Button from "../ui/Button.jsx";
import IconButton from "../ui/IconButton.jsx";
import Popover from "../ui/Popover.jsx";
import { Menu, MenuItem } from "../ui/Menu.jsx";
import { CalendarIcon, ChevronDownIcon, MenuIcon, SearchIcon, XIcon } from "../icons/index.jsx";
import NotificationBell from "./NotificationBell.jsx";
import { AccountMenuButton } from "./AccountMenu.jsx";
import { isPathActive, useNavModel } from "./navigation.js";

const navLinkClass = ({ isActive }, adult = false) =>
  cn(
    "inline-flex h-9 items-center whitespace-nowrap rounded-lg px-2 text-[13px] font-semibold tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light lg:px-3 lg:text-sm",
    adult
      ? isActive ? "bg-red-950/40 text-red-400" : "text-red-500/80 hover:bg-red-950/30 hover:text-red-400"
      : isActive ? "bg-surface-2 text-white" : "text-text-muted hover:bg-surface-2/60 hover:text-white",
  );

// "More ▾" — the overflow for secondary browse destinations (Collections, My
// Services, Adult). Its trigger reads as active when one of its items is.
function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();
  const active = items.some((l) => isPathActive(pathname, l.to));
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(navLinkClass({ isActive: active }), "gap-1")}
      >
        More
        <ChevronDownIcon size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      <Popover open={open} anchorRef={ref} onClose={() => setOpen(false)} align="start" width={224} role="menu" className="p-1">
        <Menu label="More">
          {items.map((l) => (
            <MenuItem key={l.to} to={l.to} icon={l.icon} onClick={() => setOpen(false)} className={cn(l.adult && "text-red-400 hover:text-red-300", isPathActive(pathname, l.to) && "bg-surface-2 text-white")}>
              {l.label}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </>
  );
}

// Sticky header. Zones: [☰ <md] [logo] [text nav md+] … [search] [radar md+] [bell] [account | sign-in].
function Navbar({ session, onOpenDrawer, onAuthPrompt }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const headerRef = useRef(null);
  const location = useLocation();
  const me = useCurrentUser();
  const nav = useNavModel();
  const signedIn = !!session && me.isAuthenticated;

  // Close the search panel whenever the route changes — covers picking a
  // result, hitting Enter for "explore all results", and any other navigation.
  // (State adjusted during render rather than in an effect.)
  const [seenPath, setSeenPath] = useState(location.pathname);
  if (seenPath !== location.pathname) {
    setSeenPath(location.pathname);
    setSearchOpen(false);
    setSearchValue("");
  }

  useClickOutside(headerRef, () => setSearchOpen(false), searchOpen);
  useEscapeKey(() => setSearchOpen(false), searchOpen);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-border/40 bg-surface/85 pt-safe backdrop-blur-md"
    >
      <div className="flex h-14 items-center gap-1 px-2 sm:gap-2 sm:px-4 lg:px-6 xl:px-8 landscape-short:h-12">
        {/* Left: hamburger (<md) + logo + text nav (md+) */}
        <IconButton label="Open menu" onClick={onOpenDrawer} className="h-9 w-9 md:hidden">
          <MenuIcon size={22} />
        </IconButton>

        {/* Wordmark is 7.6:1 — below `xs` (400px) only the icon mark fits. */}
        <Link to="/" className="flex shrink-0 items-center rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light" aria-label="watchpapa home">
          <img src="/logo_v3.1.svg" alt="" className="h-8 w-8 xs:hidden" aria-hidden />
          <img src={watchpapaBanner} alt="watchpapa" className="hidden h-6 w-auto drop-shadow-md xs:block sm:h-7 md:h-6 lg:h-8 landscape-short:h-6" />
        </Link>

        {/* md–lg is the tightest range (768–1023px with the text nav visible):
            compact link padding, no Radar icon (it lives in the account menu). */}
        <nav aria-label="Browse" className="ml-0.5 hidden min-w-0 items-center gap-0 md:flex lg:ml-3 lg:gap-1">
          {nav.browse.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={(s) => navLinkClass(s)}>
              {l.label}
            </NavLink>
          ))}
          <MoreMenu items={nav.more} />
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex min-w-0 items-center gap-0 sm:gap-1">
          {/* lg+: inline search field; below that an icon toggles the panel */}
          <div className="hidden w-[200px] shrink lg:block xl:w-[300px]">
            <SearchBar value={searchValue} onChange={(e) => setSearchValue(e.target.value)} maxWidthClass="max-w-none" dense />
          </div>
          <IconButton
            label={searchOpen ? "Close search" : "Search"}
            onClick={() => setSearchOpen((v) => !v)}
            active={searchOpen}
            aria-expanded={searchOpen}
            className="h-9 w-9 md:h-10 md:w-10 lg:hidden"
          >
            {searchOpen ? <XIcon size={20} /> : <SearchIcon size={20} />}
          </IconButton>

          {signedIn ? (
            <IconButton label="Releases Radar" to="/calendar" className="hidden lg:inline-flex" active={location.pathname === "/calendar"}>
              <CalendarIcon size={19} />
            </IconButton>
          ) : (
            <IconButton label="Releases Radar" onClick={onAuthPrompt} className="hidden lg:inline-flex">
              <CalendarIcon size={19} />
            </IconButton>
          )}

          {signedIn && <NotificationBell />}

          {signedIn ? (
            <AccountMenuButton className="ml-0.5" />
          ) : (
            <div className="ml-1 flex items-center gap-1.5">
              <Button to="/login" variant="ghost" size="sm" className="text-text-muted hover:text-white">
                Sign in
              </Button>
              <Button to="/register" variant="primary" size="sm" className="hidden md:inline-flex">
                Register
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Search panel — phone/tablet only; lg+ has the inline field above */}
      {searchOpen && (
        <div className="animate-slide-down border-t border-border/50 bg-surface px-3 py-3 sm:px-5 lg:hidden">
          <SearchBar value={searchValue} onChange={(e) => setSearchValue(e.target.value)} autoFocus />
        </div>
      )}
    </header>
  );
}

export default Navbar;
