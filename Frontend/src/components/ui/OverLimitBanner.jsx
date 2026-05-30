import { Link } from "react-router-dom";

// Shows a dismissable warning when a user has more follows or watchlists than their current tier allows.
// Hides automatically when the user drops back under the limit (no persistent dismiss needed).
export function OverLimitBanner({ type, current, limit, tier }) {
  if (!limit || current <= limit) return null;
  const over = current - limit;
  const isFollow = type === "follows";

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-800/40 bg-amber-900/10 px-4 py-3">
      <svg className="mt-0.5 shrink-0 text-amber-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-300">
          {isFollow
            ? `You have ${current} follow${current !== 1 ? "s" : ""} — your ${formatTier(tier)} plan allows ${limit}`
            : `You have ${current} watchlist${current !== 1 ? "s" : ""} — your ${formatTier(tier)} plan allows ${limit}`}
        </p>
        <p className="mt-0.5 text-xs text-amber-400/70">
          Remove {over} {isFollow ? (over === 1 ? "follow" : "follows") : (over === 1 ? "watchlist" : "watchlists")} or upgrade to add more.
        </p>
        <div className="mt-2 flex gap-3">
          <Link
            to="/subscription"
            className="text-xs font-semibold text-amber-300 transition hover:text-white"
          >
            Upgrade plan →
          </Link>
          {isFollow && (
            <Link
              to="/follows"
              className="text-xs text-amber-400/70 transition hover:text-amber-300"
            >
              Manage follows
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTier(tier) {
  const labels = { free: "Free", premium: "Premium", pro: "Pro", pro_plus: "Pro+", god: "God" };
  return labels[tier] ?? tier;
}
