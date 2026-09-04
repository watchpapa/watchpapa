// Home page row registry — the single place that knows what rows exist, their
// stable keys (independent of display text, so renaming a row never breaks a
// user's saved order), default order, and labels. Shared by AppHomePage.jsx
// (renders in this order) and SettingsPage.jsx (lets the user reorder/hide).
export const HOME_ROW_LABELS = {
  popular: "Popular",
  suggested: "Suggested For You",
  popularOnServices: "Popular · On Your Services",
  suggestedOnServices: "Suggested For You · On Your Services",
  comingSoon: "Coming Soon",
  movies: "Movies",
  shows: "Shows",
};

export const DEFAULT_HOME_ROW_ORDER = [
  "popular",
  "suggested",
  "popularOnServices",
  "suggestedOnServices",
  "comingSoon",
  "movies",
  "shows",
];

// Normalizes a possibly-empty or possibly-stale saved order into a full,
// current list: empty -> the app default; anything missing (a row added
// since the user last customized their order) gets appended at the end so it
// doesn't silently vanish.
export function effectiveHomeRowOrder(savedOrder) {
  const base = savedOrder && savedOrder.length > 0 ? savedOrder.filter((k) => HOME_ROW_LABELS[k]) : DEFAULT_HOME_ROW_ORDER;
  const missing = DEFAULT_HOME_ROW_ORDER.filter((k) => !base.includes(k));
  return [...base, ...missing];
}
