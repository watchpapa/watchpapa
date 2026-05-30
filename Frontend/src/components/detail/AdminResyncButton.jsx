import { useState } from "react";
import { useIsAdmin } from "../../features/admin/hooks/useIsAdmin.js";
import { useResync } from "../../features/admin/hooks/useContentResync.js";

const SCOPE_DEFS = {
  movie:  [
    { key: "details", label: "Details" },
    { key: "genres",  label: "Genres" },
    { key: "credits", label: "Credits" },
  ],
  show: [
    { key: "details",        label: "Details" },
    { key: "genres",         label: "Genres" },
    { key: "credits",        label: "Credits" },
    { key: "seasons",        label: "Seasons" },
    { key: "episodes",       label: "Episodes" },
    { key: "episodeCredits", label: "Ep. Credits" },
  ],
  person: [
    { key: "details", label: "Details" },
    { key: "aka",     label: "AKAs" },
  ],
};

function allKeys(type) {
  return Object.fromEntries((SCOPE_DEFS[type] ?? []).map((s) => [s.key, true]));
}

function AdminResyncPanel({ type, tmdbId, onClose }) {
  const defs = SCOPE_DEFS[type] ?? [];
  const [scope, setScope] = useState(() => allKeys(type));
  const { resync, getState } = useResync();
  const state = getState(type, tmdbId);

  const anySelected = defs.some((s) => scope[s.key]);

  function toggle(key) {
    setScope((s) => ({ ...s, [key]: !s[key] }));
  }

  return (
    <div className="mt-2 rounded-xl border border-[#2a3570] bg-[#0b0f26] p-3 text-xs">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-semibold uppercase tracking-widest text-[#4a4a8a]" style={{ fontSize: "10px" }}>
          Scopes
        </span>
        <button onClick={() => setScope(allKeys(type))} className="ml-auto text-[#6868b8] hover:text-white transition">All</button>
        <span className="text-[#2a3570]">·</span>
        <button
          onClick={() => setScope(Object.fromEntries(defs.map((s) => [s.key, false])))}
          className="text-[#6868b8] hover:text-white transition"
        >
          None
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {defs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={`rounded-md border px-2 py-1 font-medium transition ${
              scope[key]
                ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                : "border-[#2a3570] bg-[#12163a] text-[#5a5a78] hover:border-[#4a4a8a]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => resync(type, tmdbId, scope)}
          disabled={state.loading || !anySelected}
          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
        >
          {state.loading ? "Queuing…" : "Resync"}
        </button>
        <button onClick={onClose} className="text-[#5a5a78] hover:text-white transition">Cancel</button>
        {state.done && <span className="text-emerald-400">Queued ✓</span>}
        {state.error && <span className="text-rose-400">{state.error}</span>}
      </div>
    </div>
  );
}

function AdminResyncButton({ session, type, tmdbId }) {
  const { isAdmin, loading } = useIsAdmin(session);
  const [open, setOpen] = useState(false);

  if (loading || !isAdmin || !tmdbId) return null;

  return (
    <div className="rounded-xl border border-[#1e244a] bg-[#0a0d1f] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4a4a8a]">Admin</span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-indigo-700/50 bg-indigo-900/30 px-3 py-1 text-xs font-medium text-indigo-300 transition hover:bg-indigo-800/40 hover:text-indigo-200"
        >
          {open ? "Cancel" : "Resync with TMDB"}
        </button>
      </div>
      {open && (
        <AdminResyncPanel type={type} tmdbId={tmdbId} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

export default AdminResyncButton;
