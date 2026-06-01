import { useState } from "react";
import { Link } from "react-router-dom";
import { useObservedRatings } from "../../features/observe/hooks/useObservedRatings.js";
import { HeartDisplay } from "../rating/HeartDisplay.jsx";

// Sidebar panel on detail pages showing how people you observe rated this item.
// Folded by default; header shows the count only. Hidden when logged out or
// when none of the people you observe have rated this item.
export function ObservedRatingsPanel({ mediaType, entityId, session }) {
  const { ratings, total, loading } = useObservedRatings(mediaType, entityId, session);
  const [open, setOpen] = useState(false);

  if (!session || loading || total === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-[#2a3570]/50 bg-[#0a0c18]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#c084fc]">
          Ratings from {total} {total === 1 ? "person" : "people"} you observe
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5050b0" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul className="space-y-1 border-t border-[#2a3570]/50 px-2 py-2">
          {ratings.map((r) => (
            <li key={r.profile_id}>
              <Link
                to={`/u/${r.username}`}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition hover:bg-[#141728]"
              >
                <span className="truncate text-sm font-medium text-[#c0c0e8]">{r.username}</span>
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
