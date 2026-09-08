// The one registry of audit_events.action values. The admin audit-log UI
// fetches this (GET /api/admin/audit-log/actions) for its filter and colours,
// and the audit-log route validates the `action` filter against it, so adding
// an action means adding it here — in exactly one place.
//
// `source`: worker (auditLog middleware), db (SECURITY DEFINER triggers,
// migration 044), auth (Supabase auth.audit_log_entries, read-only tab).

export const ACTION_GROUPS = [
  { key: "account", label: "Account & profile", color: "brand" },
  { key: "privacy", label: "Privacy & content", color: "info" },
  { key: "social", label: "Social", color: "accent" },
  { key: "ratings", label: "Ratings & watch log", color: "neutral" },
  { key: "lists", label: "Watchlists & follows", color: "neutral" },
  { key: "rewards", label: "Referrals & rewards", color: "success" },
  { key: "import", label: "Import", color: "info" },
  { key: "admin", label: "Admin", color: "danger" },
  { key: "content", label: "Announcements", color: "warning" },
];

const A = (action, group, label, source = "db") => ({ action, group, label, source });

export const AUDIT_ACTIONS = [
  // Account & profile (db: audit_profile_change / audit_profile_delete)
  A("username_changed", "account", "Username changed"),
  A("dob_set", "account", "Date of birth set"),
  A("avatar_changed", "account", "Avatar changed"),
  A("bio_changed", "account", "Bio changed"),
  A("banner_changed", "account", "Profile banner changed"),
  A("marketing_opt_in_changed", "account", "Marketing opt-in changed"),
  A("role_changed", "account", "Role changed"),
  A("account_deleted", "account", "Account deleted"),
  // Privacy & content settings
  A("privacy_changed", "privacy", "Private account toggled"),
  A("profile_share_toggled", "privacy", "Profile sharing toggled"),
  A("adult_content_toggled", "privacy", "Adult content toggled"),
  A("adult_tab_toggled", "privacy", "Adult tab toggled"),
  A("nsfw_blur_toggled", "privacy", "NSFW blur toggled"),
  A("locale_changed", "privacy", "Language / region changed"),
  A("watch_settings_changed", "privacy", "Watch regions / services changed"),
  A("home_rows_changed", "privacy", "Home rows changed"),
  A("bottom_tab_preference_changed", "privacy", "Bottom tab bar preference changed"),
  // Social
  A("observe_requested", "social", "Observe requested"),
  A("observe_accepted", "social", "Observe accepted"),
  A("observe_removed", "social", "Observe removed / declined"),
  A("user_blocked", "social", "User blocked"),
  A("user_unblocked", "social", "User unblocked"),
  A("notifications_cleared", "social", "Notifications cleared"),
  A("ea_banner_dismissed", "social", "Early-adopter banner dismissed"),
  // Ratings & watch log
  A("rating_set", "ratings", "Rating set"),
  A("rating_changed", "ratings", "Rating changed"),
  A("rating_cleared", "ratings", "Rating cleared"),
  A("rating_history_removed", "ratings", "Rating history entry removed"),
  A("watch_logged", "ratings", "Watch logged"),
  A("watch_removed", "ratings", "Watch entry removed"),
  // Watchlists, favourites, follows
  A("watchlist_created", "lists", "Watchlist created"),
  A("watchlist_renamed", "lists", "Watchlist renamed"),
  A("watchlist_deleted", "lists", "Watchlist deleted"),
  A("watchlist_item_added", "lists", "Added to watchlist"),
  A("watchlist_item_removed", "lists", "Removed from watchlist"),
  A("favourite_set", "lists", "Favourite set"),
  A("favourite_cleared", "lists", "Favourite cleared"),
  A("follow_movie", "lists", "Movie followed"),
  A("unfollow_movie", "lists", "Movie unfollowed"),
  A("follow_show", "lists", "Show followed"),
  A("unfollow_show", "lists", "Show unfollowed"),
  // Referrals & rewards (worker)
  A("referral", "rewards", "Referral code used", "worker"),
  A("rewards", "rewards", "Reward code claimed", "worker"),
  // Import (worker)
  A("import_resolved", "import", "Import resolved", "worker"),
  A("import_committed", "import", "Import committed", "worker"),
  // Admin (worker)
  A("admin_role_set", "admin", "Admin: role set", "worker"),
  A("admin_tier_granted", "admin", "Admin: tier granted", "worker"),
  A("admin_tier_set", "admin", "Admin: tier set", "worker"),
  A("admin_tier_reward", "admin", "Admin: tier reward issued", "worker"),
  A("reward_code_generated", "admin", "Admin: codes generated", "worker"),
  A("reward_code_created", "admin", "Admin: code created", "worker"),
  A("reward_code_toggled", "admin", "Admin: code enabled/disabled", "worker"),
  A("reward_code_updated", "admin", "Admin: code edited", "worker"),
  A("reward_code_deleted", "admin", "Admin: code deleted", "worker"),
  A("reward_code_bulk", "admin", "Admin: bulk code action", "worker"),
  // Announcements (worker, editor+)
  A("announcement_created", "content", "Announcement created", "worker"),
  A("announcement_edited", "content", "Announcement edited", "worker"),
  A("announcement_archived", "content", "Announcement archived", "worker"),
  A("announcement_restored", "content", "Announcement restored", "worker"),
  A("announcement_deleted", "content", "Announcement deleted", "worker"),
];

export const ACTION_SET = new Set(AUDIT_ACTIONS.map((a) => a.action));
export const SOURCES = ["worker", "db", "auth"];
