import { useReferralLeaderboard } from "../../features/admin/hooks/useReferralLeaderboard.js";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { StatCard, StatGrid } from "../../components/admin/StatCard.jsx";
import { RefreshIcon } from "../../components/icons/index.jsx";

function ReferralLeaderboardPage() {
  const { data, loading, error, refresh } = useReferralLeaderboard();

  const columns = [
    { key: "n", label: "#", render: (r) => <span className="tabular-nums text-text-faint">{r._n}</span>, cardHidden: true, className: "w-12" },
    {
      key: "user", label: "User", primary: true,
      render: (r) => (
        <div>
          <p className="text-white">{r.email ?? "—"}</p>
          {r.username && <p className="text-xs text-text-dim">@{r.username}</p>}
        </div>
      ),
    },
    { key: "total", label: "Total", align: "right", render: (r) => <span className="tabular-nums text-text-muted">{r.total}</span> },
    { key: "rewarded", label: "Rewarded", align: "right", render: (r) => <span className="tabular-nums font-medium text-emerald-400">{r.rewarded}</span> },
    { key: "pending", label: "Pending", align: "right", render: (r) => <span className="tabular-nums text-amber-400">{r.pending}</span> },
    { key: "expired", label: "Expired", align: "right", hideBelow: "lg", render: (r) => <span className="tabular-nums text-text-faint">{r.expired}</span> },
  ];

  return (
    <div>
      <PageHeader size="sm" title="Referral Leaderboard" subtitle="Top referrers by rewarded referrals" actions={<Button variant="secondary" size="sm" icon={RefreshIcon} onClick={refresh} loading={loading}>Refresh</Button>} />
      {error && <ErrorNote className="mb-4" onRetry={refresh}>{error}</ErrorNote>}
      {loading && !data ? (
        <StatGrid>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</StatGrid>
      ) : data ? (
        <div className="space-y-4">
          <StatGrid>
            <StatCard label="Total" value={data.summary.total.toLocaleString()} />
            <StatCard label="Rewarded" value={data.summary.rewarded.toLocaleString()} tone="text-emerald-400" />
            <StatCard label="Pending" value={data.summary.pending.toLocaleString()} tone="text-amber-400" />
            <StatCard label="Expired" value={data.summary.expired.toLocaleString()} tone="text-text-faint" />
          </StatGrid>
          <DataTable columns={columns} rows={data.leaderboard.map((r, i) => ({ ...r, _n: i + 1 }))} rowKey={(r) => r.referrer_id} emptyTitle="No referrals yet." dense />
        </div>
      ) : null}
    </div>
  );
}

export default ReferralLeaderboardPage;
