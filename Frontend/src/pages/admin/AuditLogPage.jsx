import { useEffect, useState } from "react";
import { useAuditLog } from "../../features/admin/hooks/useAuditLog.js";

const ACTIONS = ["inject", "resolve", "referral", "rewards", "follow_movie", "unfollow_movie", "follow_show", "unfollow_show"];

const ACTION_COLOR = {
  inject:         "bg-indigo-900/40 text-indigo-400 border-indigo-700/50",
  resolve:        "bg-violet-900/40 text-violet-400 border-violet-700/50",
  referral:       "bg-cyan-900/40 text-cyan-400 border-cyan-700/50",
  rewards:        "bg-emerald-900/40 text-emerald-400 border-emerald-700/50",
  follow_movie:   "bg-[#1a1f3a] text-[#6868b8] border-[#2a3570]",
  unfollow_movie: "bg-[#1a1f3a] text-[#5a5a78] border-[#1e244a]",
  follow_show:    "bg-[#1a1f3a] text-[#6868b8] border-[#2a3570]",
  unfollow_show:  "bg-[#1a1f3a] text-[#5a5a78] border-[#1e244a]",
};

function ActionBadge({ action }) {
  const colors = ACTION_COLOR[action] ?? "bg-[#1a1f3a] text-[#6868b8] border-[#2a3570]";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors}`}>
      {action}
    </span>
  );
}

function Field({ label, value, mono }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-[#4a4a8a]">{label}</p>
      <p className={`text-sm text-[#c0c0e0] break-all ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function DetailModal({ ev, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const bodyStr = ev.body
    ? (typeof ev.body === "string" ? ev.body : JSON.stringify(ev.body, null, 2))
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#2a3570] bg-[#0e1128] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <ActionBadge action={ev.action} />
            <p className="mt-2 text-xs text-[#5a5a78]">{new Date(ev.created_at).toLocaleString()}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-[#4a4a8a] transition hover:bg-[#1a1f3a] hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email"    value={ev.email} />
            <Field label="Username" value={ev.username ? `@${ev.username}` : null} />
            <Field label="IP"       value={ev.ip} mono />
            <Field label="Method" value={ev.method} />
            <Field label="Path"   value={ev.path} mono />
          </div>
          <Field label="User ID" value={ev.user_id} mono />
          {bodyStr && bodyStr !== "{}" && bodyStr !== "null" && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-[#4a4a8a]">Body</p>
              <pre className="rounded-xl border border-[#1e244a] bg-[#12163a] p-3 text-xs text-[#c0c0e0] whitespace-pre-wrap break-all">
                {bodyStr}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuditLogPage() {
  const { events, total, loading, error, fetch } = useAuditLog();
  const [page, setPage] = useState(1);
  const limit = 50;

  const [filters, setFilters] = useState({ action: "", email: "", from: "", to: "" });
  const [applied, setApplied] = useState({ action: "", email: "", from: "", to: "" });
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetch({ page: 1, limit }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e) {
    e.preventDefault();
    setApplied(filters);
    setPage(1);
    fetch({ page: 1, limit, ...filters });
  }

  function handlePage(next) {
    setPage(next);
    fetch({ page: next, limit, ...applied });
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      {selected && <DetailModal ev={selected} onClose={() => setSelected(null)} />}

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Audit Log</h1>
        <p className="mt-0.5 text-xs text-[#6868b8]">All tracked user and system actions · click a row for details</p>
      </div>

      <form onSubmit={handleSearch} className="mb-5 flex flex-wrap gap-2 items-end">
        <select
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1.5 text-sm text-white outline-none focus:border-[#6868b8]"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          type="text"
          placeholder="Email filter…"
          value={filters.email}
          onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1.5 text-sm text-white outline-none placeholder-[#4a4a8a] focus:border-[#6868b8]"
        />
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1.5 text-sm text-white outline-none focus:border-[#6868b8]"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1.5 text-sm text-white outline-none focus:border-[#6868b8]"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
        >
          Filter
        </button>
        {(applied.action || applied.email || applied.from || applied.to) && (
          <button
            type="button"
            onClick={() => {
              const empty = { action: "", email: "", from: "", to: "" };
              setFilters(empty);
              setApplied(empty);
              setPage(1);
              fetch({ page: 1, limit, ...empty });
            }}
            className="rounded-lg border border-[#2a3570] px-3 py-1.5 text-sm text-[#8080a8] transition hover:text-white"
          >
            Clear
          </button>
        )}
      </form>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[#1e244a] bg-[#0e1128] overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-[#1e244a]">
              {["Time", "Action", "Email", "Username", "Method", "Path", "IP"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4a4a8a]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#6868b8]">Loading…</td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#4a4a8a]">No events found.</td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr
                  key={ev.id}
                  onClick={() => setSelected(ev)}
                  className="cursor-pointer border-b border-[#2a3570]/50 last:border-0 hover:bg-[#111530]"
                >
                  <td className="px-4 py-2.5 text-xs tabular-nums text-[#6868b8] whitespace-nowrap">
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <ActionBadge action={ev.action} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#8080a8] max-w-[160px] truncate">{ev.email ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6868b8] max-w-[120px] truncate">
                    {ev.username ? `@${ev.username}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#6868b8]">{ev.method}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6868b8] max-w-[160px] truncate">{ev.path}</td>
                  <td className="px-4 py-2.5 text-xs text-[#4a4a8a]">{ev.ip}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-[#6868b8]">
        <span>{total.toLocaleString()} events</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePage(page - 1)}
            disabled={page <= 1 || loading}
            className="rounded-lg border border-[#2a3570] px-3 py-1 transition hover:border-[#6868b8] hover:text-white disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-[#4a4a8a]">{page} / {totalPages}</span>
          <button
            onClick={() => handlePage(page + 1)}
            disabled={page >= totalPages || loading}
            className="rounded-lg border border-[#2a3570] px-3 py-1 transition hover:border-[#6868b8] hover:text-white disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuditLogPage;
