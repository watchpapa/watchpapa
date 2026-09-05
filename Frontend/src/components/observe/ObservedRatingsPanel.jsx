import { useState } from "react";
import { Link } from "react-router-dom";
import { useObservedRatings } from "../../features/observe/hooks/useObservedRatings.js";
import { HeartDisplay } from "../rating/HeartDisplay.jsx";
import { ChevronDownIcon } from "../icons/index.jsx";

// How people you observe rated this title. Collapsed by default; hidden when
// logged out or when nobody you observe has rated it.
export function ObservedRatingsPanel({ mediaType, entityId, session }) {
  const { ratings, total, loading } = useObservedRatings(mediaType, entityId, session);
  const [open, setOpen] = useState(false);

  if (!session || loading || total === 0) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-surface-2/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-text-muted transition hover:text-white"
      >
        <span>People you observe <span className="text-text-faint">· {total}</span></span>
        <ChevronDownIcon size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="border-t border-border/40 px-1 py-1">
          {ratings.map((r) => (
            <li key={r.profile_id}>
              <Link to={`/u/${r.username}`} className="flex min-h-9 items-center justify-between gap-2 rounded-lg px-2 py-1 transition hover:bg-surface-2">
                <span className="truncate text-sm font-medium text-text">{r.username}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <HeartDisplay value={r.value} size="sm" />
                  <span className="text-xs font-semibold text-[#a090ff]">{r.value}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
