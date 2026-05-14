import { useCallback, useEffect, useState } from "react";
import { useScriptLogs } from "../../features/admin/hooks/useScriptLogs.js";

const STATUS_COLORS = {
  success: "bg-emerald-900/40 text-emerald-400 border-emerald-700/50",
  failure: "bg-rose-900/40 text-rose-400 border-rose-800/40",
  stopped: "bg-amber-900/40 text-amber-400 border-amber-700/50",
};

function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] ?? "bg-[#1a1f3a] text-[#6868b8] border-[#2a3570]";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors}`}>
      {status}
    </span>
  );
}

function fmt(seconds) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${(seconds / 60).toFixed(1)}m`;
}

function ScriptLogsPage() {
  const { logs, total, scriptNames, loading, error, fetch } = useScriptLogs();
  const [page, setPage] = useState(1);
  const limit = 50;

  const [filters, setFilters] = useState({ script: "", status: "" });
  const [applied, setApplied] = useState({ script: "", status: "" });

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
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Script Logs</h1>
        <p className="mt-0.5 text-xs text-[#6868b8]">TMDB ingestion and maintenance script run history</p>
      </div>

      <form onSubmit={handleSearch} className="mb-5 flex flex-wrap gap-2">
        <select
          value={filters.script}
          onChange={(e) => setFilters((f) => ({ ...f, script: e.target.value }))}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1.5 text-sm text-white outline-none focus:border-[#6868b8]"
        >
          <option value="">All scripts</option>
          {scriptNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1.5 text-sm text-white outline-none focus:border-[#6868b8]"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="stopped">Stopped</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
        >
          Filter
        </button>
        {(applied.script || applied.status) && (
          <button
            type="button"
            onClick={() => {
              const empty = { script: "", status: "" };
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

      <div className="rounded-2xl border border-[#1e244a] bg-[#0e1128] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e244a]">
              {["Started", "Script", "Status", "Batch", "Runtime", "Error"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4a4a8a]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#6868b8]">Loading…</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#4a4a8a]">No logs found.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-[#1a1f3a] last:border-0 hover:bg-[#111530]">
                  <td className="px-4 py-2.5 text-xs tabular-nums text-[#6868b8] whitespace-nowrap">
                    {new Date(log.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#8080a8] max-w-[200px] truncate">
                    {log.script_name}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs tabular-nums text-[#6868b8]">
                    {log.batch_size ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs tabular-nums text-[#6868b8]">
                    {fmt(log.runtime)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-rose-400 max-w-[200px] truncate" title={log.error_detail ?? ""}>
                    {log.error_code
                      ? `${log.error_code}${log.error_detail ? ": " + log.error_detail : ""}`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-[#6868b8]">
        <span>{total.toLocaleString()} runs</span>
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

export default ScriptLogsPage;
