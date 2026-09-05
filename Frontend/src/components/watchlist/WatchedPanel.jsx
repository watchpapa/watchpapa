import { useRef, useState } from "react";
import ActionChip from "../ui/ActionChip.jsx";
import Button from "../ui/Button.jsx";
import IconButton from "../ui/IconButton.jsx";
import Popover from "../ui/Popover.jsx";
import Sheet from "../ui/Sheet.jsx";
import { CheckIcon, EyeIcon, TrashIcon } from "../icons/index.jsx";
import { useIsPhone } from "../../hooks/useMediaQuery.js";

function fmtDate(isoDate) {
  if (!isoDate) return "";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const today = () => new Date().toISOString().slice(0, 10);

// Rewatch diary control (MediaActionPanel). Unwatched → one tap logs today.
// Watched → a green chip ("Watched · 2×") opening a popover (desktop) or
// bottom sheet (phone) with "Log another watch" (dated) and the history with
// per-entry remove. `impliedWatched` is only a same-tick placeholder while the
// watch_log fetch is still `loading`; afterwards `count` is the truth.
function WatchedPanel({ entries, count, loading, impliedWatched, busy, onLogWatch, onRemoveEntry, onAuthPrompt, session }) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const chipRef = useRef(null);
  const isWatched = loading ? impliedWatched : count > 0;

  const guarded = (fn) => (...args) => {
    if (!session) { onAuthPrompt?.(); return; }
    fn(...args);
  };

  if (!isWatched) {
    return (
      <ActionChip ref={chipRef} icon={EyeIcon} label="Mark watched" onClick={guarded(() => onLogWatch())} disabled={busy} loading={busy} />
    );
  }

  const body = (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guarded(() => { onLogWatch(date || undefined); setDate(today()); if (!isPhone) setOpen(false); })();
        }}
        className="space-y-2"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-text-faint">Log another watch</p>
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Watched on"
            className="h-10 min-w-0 flex-1 rounded-xl border border-border-strong bg-surface-3 px-3 text-sm text-white outline-none focus:border-brand-light"
          />
          <Button type="submit" size="md" variant="success" loading={busy}>Log</Button>
        </div>
      </form>

      {entries.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-faint">History</p>
          <ul className="divide-y divide-border/40">
            {entries.map((e) => (
              <li key={e.id} className="flex min-h-10 items-center justify-between gap-2 text-sm text-text">
                <span>{fmtDate(e.watched_at)}</span>
                <IconButton label="Remove this watch" size="sm" onClick={guarded(() => onRemoveEntry(e.id))} disabled={busy} className="-mr-2 h-8 w-8 text-text-faint hover:text-red-300">
                  <TrashIcon size={15} />
                </IconButton>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-text-faint">Removing every entry marks this as unwatched again.</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <ActionChip
        ref={chipRef}
        icon={CheckIcon}
        tone="success"
        label={count > 1 ? `Watched · ${count}×` : "Watched"}
        sublabel="tap for diary"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      {isPhone ? (
        <Sheet open={open} onClose={() => setOpen(false)} title="Rewatch diary">{body}</Sheet>
      ) : (
        <Popover open={open} anchorRef={chipRef} onClose={() => setOpen(false)} align="start" width={300} className="p-4" aria-label="Rewatch diary">
          {body}
        </Popover>
      )}
    </>
  );
}

export default WatchedPanel;
