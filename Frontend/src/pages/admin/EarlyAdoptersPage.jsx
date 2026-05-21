import { useEffect } from "react";
import { useEarlyAdopterStats } from "../../features/admin/hooks/useEarlyAdopterStats.js";

function Stat({ label, value, dim }) {
  return (
    <div className="rounded-xl border border-[#1e244a] bg-[#12163a] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-[#4a4a8a]">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${dim ? "text-[#4a4a8a]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function EarlyAdoptersPage() {
  const {
    stats, loading, error, refresh,
    list, listTotal, listPage, listLoading, listError, fetchList, LIST_LIMIT,
  } = useEarlyAdopterStats();

  useEffect(() => { fetchList(1); }, [fetchList]);

  const pct = stats ? Math.min(100, (stats.count / stats.capacity) * 100) : 0;
  const isFull = stats?.is_full ?? false;
  const totalPages = Math.max(1, Math.ceil(listTotal / LIST_LIMIT));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Early Adopters</h1>
          <p className="mt-0.5 text-xs text-[#6868b8]">
            First {stats?.capacity?.toLocaleString() ?? "5,000"} registered users receive lifetime Premium
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-3 py-1.5 text-xs text-[#8080a8] transition hover:border-[#6868b8] hover:text-white disabled:opacity-40"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats card */}
      <div className="rounded-2xl border border-[#1e244a] bg-[#0e1128] p-6">
        {loading && !stats ? (
          <div className="text-sm text-[#6868b8]">Loading…</div>
        ) : stats ? (
          <div className="space-y-5">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold tabular-nums text-white">
                {stats.count.toLocaleString()}
              </span>
              <span className="mb-1 text-lg text-[#4a4a8a]">/ {stats.capacity.toLocaleString()}</span>
              <span className={`mb-1 ml-auto text-sm font-semibold ${isFull ? "text-rose-400" : "text-[#8080a8]"}`}>
                {isFull ? "Pool full" : `${stats.remaining.toLocaleString()} remaining`}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-[#1a1f3a]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isFull ? "bg-rose-500" : "bg-indigo-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-right text-xs text-[#4a4a8a]">{pct.toFixed(1)}% filled</div>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <Stat label="Claimed" value={stats.count.toLocaleString()} />
              <Stat label="Capacity" value={stats.capacity.toLocaleString()} />
              <Stat label="Remaining" value={isFull ? "—" : stats.remaining.toLocaleString()} dim={isFull} />
            </div>
            {isFull && (
              <div className="rounded-xl border border-rose-800/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-400">
                The early adopter pool is full. New registrations will no longer receive the lifetime Premium grant.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* User list */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4a4a8a]">
            All early adopters — {listTotal.toLocaleString()}
          </p>
        </div>

        {listError && (
          <p className="mb-2 text-sm text-red-400">{listError}</p>
        )}

        <div className="overflow-x-auto rounded-2xl border border-[#1a1f3a]">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-[#1a1f3a] text-[10px] uppercase tracking-wider text-[#5a5a78]">
                <th className="px-4 py-3 text-left font-semibold">#</th>
                <th className="px-4 py-3 text-left font-semibold">Username</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr><td colSpan={4} className="py-10 text-center text-[#5a5a78]">Loading…</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-[#5a5a78]">No early adopters yet.</td></tr>
              ) : list.map((u, i) => (
                <tr key={u.id} className="border-b border-[#1a1f3a] last:border-0 hover:bg-[#0a0c18] transition">
                  <td className="px-4 py-3 tabular-nums text-[#4a4a8a]">
                    {(listPage - 1) * LIST_LIMIT + i + 1}
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">
                    @{u.username ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[#6868b8]">{u.email}</td>
                  <td className="px-4 py-3 text-[#5a5a78]">
                    {new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              disabled={listPage <= 1}
              onClick={() => fetchList(listPage - 1)}
              className="rounded-lg border border-[#2a3570] px-3 py-1 text-xs text-[#8080a8] disabled:opacity-40 hover:border-[#6868b8] hover:text-white transition"
            >
              Prev
            </button>
            <span className="text-xs text-[#5a5a78]">{listPage} / {totalPages}</span>
            <button
              disabled={listPage >= totalPages}
              onClick={() => fetchList(listPage + 1)}
              className="rounded-lg border border-[#2a3570] px-3 py-1 text-xs text-[#8080a8] disabled:opacity-40 hover:border-[#6868b8] hover:text-white transition"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default EarlyAdoptersPage;
