import { Link, useLocation } from "react-router-dom";
import { cn } from "../../lib/cn.js";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import { usePreferences } from "../../features/preferences/PreferencesContext.jsx";
import { isProTier } from "../../lib/tier.js";
import Avatar from "../ui/Avatar.jsx";
import { CalendarIcon, CompassIcon, HomeIcon, PlayIcon, SearchIcon, UserIcon } from "../icons/index.jsx";
import { BROWSE_PATH_PREFIXES } from "./navigation.js";

// Phone-only primary navigation (hidden from `md` and on rotated phones).
// Five thumb-reachable tabs; Browse opens the drawer, You opens the account
// sheet (or /login when signed out), Calendar prompts sign-in when signed out.
// The middle slot is Search by default, but Pro+ accounts (who can actually
// use My Services) default to that instead — Settings → Preferences lets
// them switch back. Below Pro it's always Search, no toggle shown there.
function BottomTabBar({ onOpenBrowse, onOpenAccount, onAuthPrompt }) {
  const { pathname } = useLocation();
  const me = useCurrentUser();
  const { bottomTabMiddle } = usePreferences();

  const browseActive = BROWSE_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const youActive = pathname.startsWith("/u/") || pathname === "/settings" || pathname === "/profile/edit";
  const middleIsServices = isProTier(me.tier) && bottomTabMiddle === "services";

  const tabs = [
    { key: "home", label: "Home", icon: HomeIcon, to: "/", active: pathname === "/" },
    { key: "browse", label: "Browse", icon: CompassIcon, onClick: onOpenBrowse, active: browseActive },
    middleIsServices
      ? { key: "services", label: "Services", icon: PlayIcon, to: "/my-services", active: pathname === "/my-services" }
      : { key: "search", label: "Search", icon: SearchIcon, to: "/search", active: pathname === "/search" },
    me.isAuthenticated
      ? { key: "calendar", label: "Radar", icon: CalendarIcon, to: "/calendar", active: pathname === "/calendar" }
      : { key: "calendar", label: "Radar", icon: CalendarIcon, onClick: onAuthPrompt, active: false },
    me.isAuthenticated
      ? { key: "you", label: "You", avatar: true, onClick: onOpenAccount, active: youActive, badge: (me.unreadNotifications || 0) + (me.pendingRequests || 0) }
      : { key: "you", label: "Sign in", icon: UserIcon, to: "/login", active: pathname === "/login" },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-surface/95 backdrop-blur-md pb-safe md:hidden landscape-short:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const cls = cn(
            "flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:bg-surface-2",
            t.active ? "text-white" : "text-text-muted active:text-white",
          );
          const inner = (
            <>
              <span className={cn("relative flex h-7 w-7 items-center justify-center rounded-lg", t.active && "bg-brand/25 text-brand-light")}>
                {t.avatar ? (
                  <Avatar
                    username={me.username}
                    avatarType={me.avatar.type}
                    avatarPosterPath={me.avatar.posterPath}
                    avatarUploadPath={me.avatar.uploadPath}
                    size="xs"
                    className={cn("h-6 w-6 text-[10px]", t.active && "ring-2 ring-brand")}
                  />
                ) : (
                  <Icon size={21} strokeWidth={t.active ? 2.2 : 1.8} />
                )}
                {t.badge > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-[#1a0b2e]">
                    {t.badge > 99 ? "99+" : t.badge}
                  </span>
                )}
              </span>
              <span className="leading-none">{t.label}</span>
            </>
          );
          return (
            <li key={t.key} className="min-w-0">
              {t.to ? (
                <Link to={t.to} className={cls} aria-current={t.active ? "page" : undefined} aria-label={t.label}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={t.onClick} className={cls} aria-label={t.label} aria-pressed={t.active || undefined}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default BottomTabBar;
