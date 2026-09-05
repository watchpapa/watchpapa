import { useState } from "react";
import { useRatingHistory } from "../../features/rating/hooks/useRatingHistory.js";
import IconButton from "../ui/IconButton.jsx";
import { ChevronDownIcon, TrashIcon } from "../icons/index.jsx";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Only renders once a rating has actually changed at least once — a fresh,
// never-edited rating has nothing more to show than RatingSidebar already
// does. Removing entries edits the historical record only (the live rating is
// untouched); dropping below 2 entries hides the panel again.
function RatingHistoryPanel({ mediaType, entityId, session }) {
  const [expanded, setExpanded] = useState(false);
  const { entries, loading, busy, removeEntry } = useRatingHistory(mediaType, entityId, session);

  if (!session || loading || entries.length < 2) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-surface-2/40">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-text-muted transition hover:text-white"
      >
        <span>Rating history <span className="text-text-faint">· {entries.length}</span></span>
        <ChevronDownIcon size={14} className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <ul className="border-t border-border/40 px-3 py-1">
          {entries.map((e) => (
            <li key={e.id} className="flex min-h-9 items-center justify-between gap-2 text-xs text-text">
              <span className="font-semibold text-[#a090ff]">{e.value}/10</span>
              <span className="ml-auto text-text-faint">{fmtDate(e.changed_at)}</span>
              <IconButton label="Remove this entry" size="sm" variant="ghost" onClick={() => removeEntry(e.id)} disabled={busy} className="-mr-2 h-8 w-8 text-text-faint hover:text-red-300">
                <TrashIcon size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RatingHistoryPanel;
