import { useState } from "react";

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function fmtDate(isoDate) {
  if (!isoDate) return "";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const today = () => new Date().toISOString().slice(0, 10);

// Sidebar "Watched" section for MoviePage/ShowPage — a rewatch diary, not
// just a boolean. `impliedWatched` (from a rating, or every season/episode
// of a show rated — see useShowCompletion.js) is only used as a same-tick
// placeholder before the real watch_log fetch (`loading`) resolves, so
// rating something shows "Watched" instantly instead of flashing "Mark
// watched" first. Once loaded, `count` is the sole source of truth —
// removing every logged entry always shows unwatched, even for a rated
// title, since a rating only ever seeds a log entry once (see useRating.js).
// Logging a watch always removes the title from any watchlist it's on.
function WatchedPanel({ entries, count, loading, impliedWatched, busy, onLogWatch, onRemoveEntry, onAuthPrompt, session }) {
  const [expanded, setExpanded] = useState(false);
  const [pickingDate, setPickingDate] = useState(null); // ISO date string while the inline date field is open
  const isWatched = loading ? impliedWatched : count > 0;

  function guarded(fn) {
    return (...args) => {
      if (!session) {
        onAuthPrompt?.();
        return;
      }
      fn(...args);
    };
  }

  const openDatePicker = guarded(() => setPickingDate(today()));

  if (!isWatched) {
    return (
      <button
        onClick={guarded(() => onLogWatch())}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2a3570] bg-transparent px-3 py-2 text-xs font-medium uppercase tracking-widest text-[#6868b8] transition hover:border-[#3a3a7a] hover:text-white disabled:opacity-50"
      >
        <EyeIcon />
        Mark watched
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-green-600/50 bg-green-900/10 px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-widest text-green-400">
        <span className="flex items-center gap-1.5">
          <CheckIcon />
          {count > 1 ? `Watched · ${count}×` : "Watched"}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={openDatePicker} disabled={busy} aria-label="Log another watch" className="text-green-400 transition hover:text-green-300 disabled:opacity-50">
            <PlusIcon />
          </button>
          {count > 0 && (
            <button onClick={() => setExpanded((v) => !v)} aria-label="Show watch history" className="text-green-400 transition hover:text-green-300">
              <ChevronIcon open={expanded} />
            </button>
          )}
        </div>
      </div>

      {pickingDate !== null && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guarded(() => {
              onLogWatch(pickingDate || undefined);
              setPickingDate(null);
            })();
          }}
          className="mt-2 flex items-center gap-1.5 border-t border-green-600/30 pt-2"
        >
          <input
            type="date"
            value={pickingDate}
            onChange={(e) => setPickingDate(e.target.value)}
            max={today()}
            className="min-w-0 flex-1 rounded border border-green-700/50 bg-[#0a0c18] px-1.5 py-1 text-[11px] text-white outline-none"
          />
          <button type="submit" disabled={busy} className="rounded bg-green-800/60 px-2 py-1 text-[10px] font-bold text-green-200 transition hover:bg-green-700/60 disabled:opacity-50">
            Save
          </button>
          <button type="button" onClick={() => setPickingDate(null)} className="text-[10px] text-green-700 transition hover:text-green-400">
            Cancel
          </button>
        </form>
      )}

      {expanded && count > 0 && (
        <div className="mt-2 space-y-1.5 border-t border-green-600/30 pt-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-[11px] text-green-200/80">
              <span>{fmtDate(e.watched_at)}</span>
              <button
                onClick={guarded(() => onRemoveEntry(e.id))}
                disabled={busy}
                aria-label="Remove this watch"
                className="text-green-700 transition hover:text-red-400 disabled:opacity-50"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WatchedPanel;
