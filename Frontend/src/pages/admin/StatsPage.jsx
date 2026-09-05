import { useTierStats } from "../../features/admin/hooks/useTierStats.js";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { StatCard, StatGrid } from "../../components/admin/StatCard.jsx";
import { RefreshIcon } from "../../components/icons/index.jsx";
import { tierLabel } from "../../lib/tierMeta.js";

const TIER_ORDER = ["free", "premium", "pro", "pro_plus", "god"];
const TIER_COLOR = {
  free: { bar: "bg-emerald-600", text: "text-emerald-400" },
  premium: { bar: "bg-amber-500", text: "text-amber-400" },
  pro: { bar: "bg-sky-500", text: "text-sky-400" },
  pro_plus: { bar: "bg-violet-500", text: "text-violet-400" },
  god: { bar: "bg-rose-500", text: "text-rose-400" },
};

function TierRow({ tier, count, total }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const colors = TIER_COLOR[tier] ?? TIER_COLOR.free;
  return (
    <div className="flex items-center gap-3">
      <span className={`w-16 shrink-0 text-right text-sm font-medium ${colors.text}`}>{tierLabel(tier)}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div className={`h-full rounded-full transition-all duration-500 ${colors.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right text-sm tabular-nums text-text-muted">
        {count.toLocaleString()}<span className="ml-1.5 text-xs text-text-faint">({pct.toFixed(1)}%)</span>
      </span>
    </div>
  );
}

function StatsPage() {
  const { stats, loading, error, refresh } = useTierStats();
  const tierMap = Object.fromEntries((stats?.tiers ?? []).map((t) => [t.tier, t.count]));
  const paid = stats ? stats.total - (tierMap.free ?? 0) : 0;

  return (
    <div>
      <PageHeader size="sm" title="Overview" subtitle="User distribution across subscription tiers" actions={<Button variant="secondary" size="sm" icon={RefreshIcon} onClick={refresh} loading={loading}>Refresh</Button>} />
      {error && <ErrorNote className="mb-4" onRetry={refresh}>{error}</ErrorNote>}
      {loading && !stats ? (
        <StatGrid>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</StatGrid>
      ) : stats ? (
        <div className="space-y-4">
          <StatGrid>
            <StatCard label="Total users" value={stats.total.toLocaleString()} />
            <StatCard label="Paid / upgraded" value={paid.toLocaleString()} sub={stats.total ? `${((paid / stats.total) * 100).toFixed(1)}% of total` : undefined} />
            <StatCard label="Premium" value={(tierMap.premium ?? 0).toLocaleString()} />
            <StatCard label="Pro & Pro+" value={((tierMap.pro ?? 0) + (tierMap.pro_plus ?? 0)).toLocaleString()} />
          </StatGrid>
          <div className="rounded-2xl border border-border/50 bg-surface p-4 sm:p-6">
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-text-faint">Tier breakdown</p>
            <div className="space-y-4">
              {TIER_ORDER.map((t) => <TierRow key={t} tier={t} count={tierMap[t] ?? 0} total={stats.total} />)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default StatsPage;
