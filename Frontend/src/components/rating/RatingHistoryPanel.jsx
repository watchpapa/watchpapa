import { useState } from "react";
import { useRatingHistory } from "../../features/rating/hooks/useRatingHistory.js";

function ChevronIcon({ open }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Only renders once a rating has actually changed at least once — a fresh,
// never-edited rating has nothing more to show than what RatingSidebar
// already displays. Removing entries edits the historical record only (the
// live rating is untouched) — dropping below 2 entries hides the panel
// again, same threshold as the initial render.
function RatingHistoryPanel({ mediaType, entityId, session }) {
  const [expanded, setExpanded] = useState(false);
  const { entries, loading, busy, removeEntry } = useRatingHistory(mediaType, entityId, session);

  if (!session || loading || entries.length < 2) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-widest text-[#8383e7] transition hover:text-white"
      >
        <span>Rating history</span>
        <ChevronIcon open={expanded} />
      </button>
      {expanded && (
        <ul className="mt-1.5 space-y-1 border-t border-[#2a3570]/40 pt-1.5">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between text-[11px] text-[#a0a0e8]">
              <span>{e.value}/10</span>
              <span className="flex items-center gap-2">
                <span className="text-[#5050a0]">{fmtDate(e.changed_at)}</span>
                <button
                  onClick={() => removeEntry(e.id)}
                  disabled={busy}
                  aria-label="Remove this entry"
                  className="text-[#5050a0] transition hover:text-red-400 disabled:opacity-50"
                >
                  <TrashIcon />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RatingHistoryPanel;
