import { useRef, useState } from "react";
import { useContentSearch, useResync, useBulkResync } from "../../features/admin/hooks/useContentResync.js";

const TMDB_IMG = "https://image.tmdb.org/t/p/w92";

const SCOPE_DEFS = {
  movie: [
    { key: "details", label: "Details", desc: "Title, overview, runtime, dates, ratings" },
    { key: "genres",  label: "Genres",  desc: "Genre links" },
    { key: "credits", label: "Credits", desc: "Full cast & crew" },
  ],
  show: [
    { key: "details",        label: "Details",         desc: "Name, overview, air dates, ratings" },
    { key: "genres",         label: "Genres",          desc: "Genre links" },
    { key: "credits",        label: "Credits",         desc: "Show-level cast & crew" },
    { key: "seasons",        label: "Seasons",         desc: "Season rows" },
    { key: "episodes",       label: "Episodes",        desc: "Episode rows" },
    { key: "episodeCredits", label: "Episode Credits", desc: "Per-episode cast & crew (slow)" },
  ],
  person: [
    { key: "details", label: "Details", desc: "Name, biography, birth date, etc." },
    { key: "aka",     label: "AKAs",    desc: "Alternate names / aliases" },
  ],
};

const TYPE_BADGE = {
  movie:  { label: "Movie",  cls: "bg-blue-900/50 text-blue-300 border-blue-700/50" },
  show:   { label: "Show",   cls: "bg-violet-900/50 text-violet-300 border-violet-700/50" },
  person: { label: "Person", cls: "bg-amber-900/50 text-amber-300 border-amber-700/50" },
};

function TypeBadge({ type }) {
  const t = TYPE_BADGE[type] ?? { label: type, cls: "bg-[#1a1f3a] text-[#6868b8] border-[#2a3570]" };
  return (
    <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${t.cls}`}>
      {t.label}
    </span>
  );
}

function allKeys(type) {
  return Object.fromEntries((SCOPE_DEFS[type] ?? []).map((s) => [s.key, true]));
}

function ResyncPanel({ item, onClose }) {
  const defs = SCOPE_DEFS[item.type] ?? [];
  const [scope, setScope] = useState(() => allKeys(item.type));
  const { resync, getState } = useResync();
  const state = getState(item.type, item.tmdbId);

  function toggle(key) {
    setScope((s) => ({ ...s, [key]: !s[key] }));
  }

  function selectAll() {
    setScope(allKeys(item.type));
  }

  function selectNone() {
    setScope(Object.fromEntries(defs.map((s) => [s.key, false])));
  }

  const anySelected = defs.some((s) => scope[s.key]);

  function handleResync() {
    resync(item.type, item.tmdbId, scope);
  }

  return (
    <div className="mt-3 rounded-xl border border-[#2a3570] bg-[#0b0f26] p-4">
      {defs.length > 0 && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4a4a8a]">Fields to resync</p>
            <button
              onClick={selectAll}
              className="ml-auto text-[10px] text-[#6868b8] hover:text-white transition"
            >All</button>
            <span className="text-[#2a3570]">·</span>
            <button
              onClick={selectNone}
              className="text-[10px] text-[#6868b8] hover:text-white transition"
            >None</button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {defs.map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => toggle(key)}
                title={desc}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  scope[key]
                    ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                    : "border-[#2a3570] bg-[#12163a] text-[#5a5a78] hover:border-[#4a4a8a] hover:text-[#8080a8]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleResync}
          disabled={state.loading || !anySelected}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
        >
          {state.loading ? "Queuing…" : "Resync"}
        </button>
        <button
          onClick={onClose}
          className="text-xs text-[#5a5a78] hover:text-white transition"
        >
          Cancel
        </button>
        {state.done && (
          <span className="text-xs text-emerald-400">Queued — check Script Logs for result</span>
        )}
        {state.error && (
          <span className="text-xs text-rose-400">{state.error}</span>
        )}
      </div>
    </div>
  );
}

function ResultRow({ item }) {
  const [open, setOpen] = useState(false);
  const poster = item.posterPath ? `${TMDB_IMG}${item.posterPath}` : null;

  return (
    <div className="border-b border-[#2a3570]/50 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#111530] transition"
      >
        {poster ? (
          <img
            src={poster}
            alt=""
            className="h-12 w-8 shrink-0 rounded object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-12 w-8 shrink-0 rounded bg-[#1a1f3a]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-white">{item.title}</p>
            {item.year && <span className="shrink-0 text-xs text-[#5a5a78]">{item.year}</span>}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <TypeBadge type={item.type} />
            <span className="text-[10px] text-[#4a4a8a]">TMDB {item.tmdbId}</span>
          </div>
        </div>
        <span className="shrink-0 text-xs text-[#4a4a8a]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <ResyncPanel item={item} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

const TIME_WINDOWS = [
  { label: "All time",    value: "" },
  { label: "Last 24h",   value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
];

function sinceFromWindow(window) {
  if (!window) return null;
  const now = Date.now();
  const ms = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 }[window];
  return new Date(now - ms).toISOString();
}

function BulkResyncSection() {
  const [bulkType, setBulkType] = useState("");
  const [timeWindow, setTimeWindow] = useState("");
  const { bulkResync, bulkState } = useBulkResync();

  function handleBulk() {
    if (!bulkType) return;
    bulkResync(bulkType, sinceFromWindow(timeWindow));
  }

  return (
    <div className="mb-8 rounded-2xl border border-[#1e244a] bg-[#0e1128] p-5">
      <h2 className="mb-0.5 text-sm font-semibold text-white">Bulk Resync</h2>
      <p className="mb-4 text-xs text-[#6868b8]">
        Queue all items of a type (optionally filtered by last-updated window). Capped at 1,000 items per request — use the time filter to narrow the scope.
      </p>

      <div className="flex flex-wrap gap-2">
        <select
          value={bulkType}
          onChange={(e) => setBulkType(e.target.value)}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1.5 text-sm text-white outline-none focus:border-[#6868b8]"
        >
          <option value="">Select type…</option>
          <option value="movie">Movies</option>
          <option value="show">Shows</option>
          <option value="person">People</option>
        </select>

        <select
          value={timeWindow}
          onChange={(e) => setTimeWindow(e.target.value)}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1.5 text-sm text-white outline-none focus:border-[#6868b8]"
        >
          {TIME_WINDOWS.map((w) => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>

        <button
          onClick={handleBulk}
          disabled={!bulkType || bulkState.loading}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
        >
          {bulkState.loading ? "Queuing…" : "Bulk Resync"}
        </button>
      </div>

      {bulkState.result && (
        <div className="mt-3 rounded-lg border border-emerald-800/40 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-300">
          Queued <strong>{bulkState.result.queued}</strong> items
          {bulkState.result.capped ? " (hit 1,000-item cap — narrow the time window to catch more)" : ""}
          {" "}— check Script Logs for results.
        </div>
      )}
      {bulkState.error && (
        <div className="mt-3 rounded-lg border border-red-800/40 bg-red-900/20 px-3 py-2 text-xs text-red-400">
          {bulkState.error}
        </div>
      )}
    </div>
  );
}

function ContentResyncPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const { results, loading, error, search } = useContentSearch();
  const debounceRef = useRef(null);

  function handleQueryChange(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(val, typeFilter);
    }, 350);
  }

  function handleTypeChange(e) {
    const val = e.target.value;
    setTypeFilter(val);
    clearTimeout(debounceRef.current);
    search(query, val);
  }

  function handleSubmit(e) {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    search(query, typeFilter);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Content Resync</h1>
        <p className="mt-0.5 text-xs text-[#6868b8]">Search the local database and manually resync any item from TMDB</p>
      </div>

      <BulkResyncSection />

      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">Per-item Resync</h2>
        <p className="mt-0.5 text-xs text-[#6868b8]">Search the local database and resync a specific item</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-5 flex flex-wrap gap-2">
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="Search by title or name…"
          className="flex-1 min-w-[200px] rounded-lg border border-[#2a3570] bg-[#12163a] px-3 py-1.5 text-sm text-white placeholder-[#4a4a8a] outline-none focus:border-[#6868b8]"
          autoFocus
        />
        <select
          value={typeFilter}
          onChange={handleTypeChange}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1.5 text-sm text-white outline-none focus:border-[#6868b8]"
        >
          <option value="">All types</option>
          <option value="movie">Movies</option>
          <option value="show">Shows</option>
          <option value="person">People</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-2xl border border-[#1e244a] bg-[#0e1128] overflow-hidden">
          {results.map((item) => (
            <ResultRow key={`${item.type}:${item.tmdbId}`} item={item} />
          ))}
        </div>
      )}

      {!loading && query.length >= 2 && results.length === 0 && !error && (
        <p className="text-sm text-[#4a4a8a]">No results found in the local database.</p>
      )}

      {!loading && query.length < 2 && results.length === 0 && (
        <p className="text-sm text-[#4a4a8a]">Type at least 2 characters to search.</p>
      )}
    </div>
  );
}

export default ContentResyncPage;
