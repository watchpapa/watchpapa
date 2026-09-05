import {
  ActivityIcon,
  BellIcon,
  BookmarkIcon,
  CalendarIcon,
  EditIcon,
  EyeIcon,
  FilmIcon,
  GiftIcon,
  HeartIcon,
  ImportIcon,
  LayersIcon,
  PlayIcon,
  SettingsIcon,
  SparklesIcon,
  TvIcon,
  UserPlusIcon,
  UsersIcon,
} from "../icons/index.jsx";
import { usePreferences } from "../../features/preferences/PreferencesContext.jsx";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";

// The app's information architecture, in one place. Navbar (desktop text
// nav + "More"), MobileDrawer, AccountMenu and BottomTabBar all render from
// these lists so an item is never missing from one surface and present on
// another.

export const BROWSE_LINKS = [
  { label: "Popular", to: "/", end: true, icon: SparklesIcon },
  { label: "Movies", to: "/movies", icon: FilmIcon },
  { label: "Shows", to: "/shows", icon: TvIcon },
  { label: "People", to: "/people", icon: UsersIcon },
];

export const MORE_LINKS = [
  { label: "Collections", to: "/collections", icon: LayersIcon },
  { label: "My Services", to: "/my-services", icon: PlayIcon },
];

// Hidden unless BOTH "show adult content" and the separate "Adult tab" opt-in
// are on — AdultPage self-guards for direct URL visits.
export const ADULT_LINK = { label: "Adult", to: "/adult", icon: EyeIcon, adult: true };

export const LIBRARY_LINKS = [
  { label: "Watchlists", to: "/watchlists", icon: BookmarkIcon },
  { label: "Follows", to: "/follows", icon: HeartIcon },
  { label: "Releases Radar", to: "/calendar", icon: CalendarIcon },
  { label: "Import", to: "/import", icon: ImportIcon },
];

export const SOCIAL_LINKS = [
  { label: "Activity", to: "/feed", icon: ActivityIcon },
  { label: "Find People", to: "/users", icon: UsersIcon },
  { label: "Observe Requests", to: "/observe-requests", icon: UserPlusIcon, badgeKey: "pendingRequests" },
  { label: "Notifications", to: "/notifications", icon: BellIcon, badgeKey: "unreadNotifications" },
];

export const ACCOUNT_LINKS = [
  { label: "Edit profile", to: "/profile/edit", icon: EditIcon },
  { label: "Settings", to: "/settings", icon: SettingsIcon },
  { label: "Plan & rewards", to: "/subscription", icon: GiftIcon },
];

// Paths the bottom tab bar's "Browse" tab counts as active.
export const BROWSE_PATH_PREFIXES = ["/movies", "/shows", "/people", "/collections", "/my-services", "/adult"];

export function useNavModel() {
  const { showAdult, showAdultTab } = usePreferences();
  const me = useCurrentUser();
  const more = showAdult && showAdultTab ? [...MORE_LINKS, ADULT_LINK] : MORE_LINKS;
  const social = SOCIAL_LINKS.map((l) => (l.badgeKey ? { ...l, badge: me[l.badgeKey] || 0 } : l));
  return {
    browse: BROWSE_LINKS,
    more,
    library: LIBRARY_LINKS,
    social,
    account: ACCOUNT_LINKS,
    isAdmin: me.isAdmin,
    isAuthenticated: me.isAuthenticated,
  };
}

export function isPathActive(pathname, to, end = false) {
  if (end || to === "/") return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}
