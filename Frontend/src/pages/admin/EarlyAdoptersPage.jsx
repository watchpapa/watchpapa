import { useEarlyAdopterStats } from "../../features/admin/hooks/useEarlyAdopterStats.js";

function EarlyAdoptersPage() {
  const { stats, loading, error, refresh } = useEarlyAdopterStats();

  const pct = stats ? Math.min(100, (stats.count / stats.capacity) * 100) : 0;
  const isFull = stats?.is_full ?? false;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Early Adopters</h1>
          <p className="mt-0.5 text-xs text-[#6868b8]">First {stats?.capacity?.toLocaleString() ?? "5,000"} registered users receive lifetime Premium</p>
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
        <div className="mb-4 rounded-xl border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[#1e244a] bg-[#0e1128] p-6">
        {loading && !stats ? (
          <div className="text-sm text-[#6868b8]">Loading…</div>
        ) : stats ? (
          <div className="space-y-5">
            {/* Numbers */}
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold tabular-nums text-white">
                {stats.count.toLocaleString()}
              </span>
              <span className="mb-1 text-lg text-[#4a4a8a]">/ {stats.capacity.toLocaleString()}</span>
              <span className={`mb-1 ml-auto text-sm font-semibold ${isFull ? "text-rose-400" : "text-[#8080a8]"}`}>
                {isFull ? "Pool full" : `${stats.remaining.toLocaleString()} remaining`}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-[#1a1f3a]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isFull ? "bg-rose-500" : "bg-indigo-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="text-right text-xs text-[#4a4a8a]">
              {pct.toFixed(1)}% filled
            </div>

            {/* Stats grid */}
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
    </div>
  );
}

function Stat({ label, value, dim }) {
  return (
    <div className="rounded-xl border border-[#1e244a] bg-[#12163a] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-[#4a4a8a]">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${dim ? "text-[#4a4a8a]" : "text-white"}`}>{value}</p>
    </div>
  );
}

export default EarlyAdoptersPage;
