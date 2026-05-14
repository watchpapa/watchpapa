import { useTierStats } from "../../features/admin/hooks/useTierStats.js";

const TIER_ORDER = ["free", "premium", "pro", "pro_plus", "god"];
const TIER_LABEL = { free: "Free", premium: "Premium", pro: "Pro", pro_plus: "Pro+", god: "God" };
const TIER_COLOR = {
  free:      { bar: "bg-green-600",    text: "text-green-400" },
  premium:   { bar: "bg-amber-500",    text: "text-amber-400" },
  pro:       { bar: "bg-sky-500",      text: "text-sky-400" },
  pro_plus:  { bar: "bg-violet-500",   text: "text-violet-400" },
  god:       { bar: "bg-rose-500",     text: "text-rose-400" },
};

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-[#1e244a] bg-[#12163a] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-[#4a4a8a]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#4a4a8a]">{sub}</p>}
    </div>
  );
}

function TierRow({ tier, count, total }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const colors = TIER_COLOR[tier] ?? TIER_COLOR.free;
  return (
    <div className="flex items-center gap-3">
      <span className={`w-16 shrink-0 text-right text-sm font-medium ${colors.text}`}>
        {TIER_LABEL[tier] ?? tier}
      </span>
      <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-[#1a1f3a]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-sm tabular-nums text-[#8080a8]">
        {count.toLocaleString()}
        <span className="ml-1.5 text-xs text-[#4a4a8a]">({pct.toFixed(1)}%)</span>
      </span>
    </div>
  );
}

function StatsPage() {
  const { stats, loading, error, refresh } = useTierStats();

  const tierMap = Object.fromEntries((stats?.tiers ?? []).map((t) => [t.tier, t.count]));
  const ordered = TIER_ORDER.map((t) => ({ tier: t, count: tierMap[t] ?? 0 }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Overview</h1>
          <p className="mt-0.5 text-xs text-[#6868b8]">User distribution across subscription tiers</p>
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

      {loading && !stats ? (
        <p className="text-sm text-[#6868b8]">Loading…</p>
      ) : stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Users" value={stats.total.toLocaleString()} />
            <StatCard
              label="Paid / Upgraded"
              value={(stats.total - (tierMap.free ?? 0)).toLocaleString()}
              sub={`${(((stats.total - (tierMap.free ?? 0)) / stats.total) * 100).toFixed(1)}% of total`}
            />
            <StatCard label="Premium" value={(tierMap.premium ?? 0).toLocaleString()} />
            <StatCard label="Pro & Pro+" value={((tierMap.pro ?? 0) + (tierMap.pro_plus ?? 0)).toLocaleString()} />
          </div>

          <div className="rounded-2xl border border-[#1e244a] bg-[#0e1128] p-6">
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-[#4a4a8a]">
              Tier breakdown
            </p>
            <div className="space-y-4">
              {ordered.map(({ tier, count }) => (
                <TierRow key={tier} tier={tier} count={count} total={stats.total} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default StatsPage;
