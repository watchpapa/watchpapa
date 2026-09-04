// New follows are blocked once a movie is released or a show has finished — a
// follow only tracks upcoming releases. Existing follows are never touched here:
// nothing in the calendar/follows data path filters by release/end state, so an
// already-followed released movie or ended show keeps showing everywhere it did
// before. This module is purely client-side (the DB can't know TMDB release
// dates) — it only decides whether the *insert* is allowed.

const FINISHED_SHOW_STATUSES = new Set(["ended", "canceled", "cancelled"]);

// Local YYYY-MM-DD, not toISOString() (which is UTC and can be a day off for
// users west/east of UTC around midnight).
export function todayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Accepts a movie detail payload or card: prefers the region-aware effective date
// (release_date_effective / date) over the raw TMDB primary date.
export function movieFollowBlock(movie) {
  if (!movie) return null;
  if (movie.status === "Released") return "Released";
  const effective = movie.release_date_effective ?? movie.date ?? movie.release_date ?? null;
  if (effective && effective.slice(0, 10) <= todayKey()) return "Released";
  return null;
}

export function isMovieReleased(movie) {
  return movieFollowBlock(movie) !== null;
}

// Accepts a show detail payload or card. Unknown status never blocks — TMDB list
// rows don't carry `status`, and it's better to allow a follow than to wrongly
// block one.
export function showFollowBlock(show) {
  if (!show?.status) return null;
  const s = show.status.toLowerCase();
  if (FINISHED_SHOW_STATUSES.has(s)) return show.status === "Canceled" || show.status === "Cancelled" ? "Canceled" : "Ended";
  return null;
}

export function isShowFinished(show) {
  return showFollowBlock(show) !== null;
}

export function followBlock(type, item) {
  return type === "movie" ? movieFollowBlock(item) : showFollowBlock(item);
}

export const FOLLOW_BLOCK_TOOLTIP = {
  Released: "Already released — follows track upcoming releases.",
  Ended: "This show has ended — nothing left to track.",
  Canceled: "This show was canceled — nothing left to track.",
};

// --- FollowsPage / calendar lifecycle chips ---------------------------------
// Lifted from the (now-deleted) ManageFollowsModal — same behaviour, just moved
// to a shared, testable module.

export function movieLifecycleLabel(movie) {
  const date = movie?.release_date_effective ?? movie?.date ?? movie?.release_date ?? null;
  if (!date) return { text: "Date TBD", color: "text-[#8888c8]" };
  return date.slice(0, 10) < todayKey()
    ? { text: "Released", color: "text-[#8888c8]" }
    : { text: "Upcoming", color: "text-green-400" };
}

export function showStatusInfo(status) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("return")) return { text: "Returning Series", color: "text-green-400" };
  if (s.includes("ended")) return { text: "Ended", color: "text-[#8888c8]" };
  if (s.includes("cancel")) return { text: "Cancelled", color: "text-red-400" };
  if (s.includes("production")) return { text: "In Production", color: "text-amber-400" };
  if (s.includes("pilot")) return { text: "Pilot", color: "text-amber-400" };
  if (s.includes("plan")) return { text: "Planned", color: "text-[#8888c8]" };
  return { text: status, color: "text-[#8888c8]" };
}
