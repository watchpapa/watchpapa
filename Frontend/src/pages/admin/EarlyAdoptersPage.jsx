import { useEffect } from "react";
import { useEarlyAdopterStats } from "../../features/admin/hooks/useEarlyAdopterStats.js";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { StatCard } from "../../components/admin/StatCard.jsx";
import { RefreshIcon } from "../../components/icons/index.jsx";

function Pager({ page, totalPages, onPage, loading }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-text-faint">
      <Button variant="outline" size="xs" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>Prev</Button>
      <span>{page} / {totalPages}</span>
      <Button variant="outline" size="xs" disabled={page >= totalPages || loading} onClick={() => onPage(page + 1)}>Next</Button>
    </div>
  );
}

function EarlyAdoptersPage() {
  const { stats, loading, error, refresh, list, listTotal, listPage, listLoading, listError, fetchList, LIST_LIMIT } = useEarlyAdopterStats();

  useEffect(() => { fetchList(1); }, [fetchList]);

  const pct = stats ? Math.min(100, (stats.count / stats.capacity) * 100) : 0;
  const isFull = stats?.is_full ?? false;
  const totalPages = Math.max(1, Math.ceil(listTotal / LIST_LIMIT));

  const columns = [
    { key: "n", label: "#", render: (u) => <span className="tabular-nums text-text-faint">{u._n}</span>, cardHidden: true, className: "w-12" },
    { key: "username", label: "Username", primary: true, render: (u) => <span className="font-semibold text-white">@{u.username ?? "—"}</span> },
    { key: "email", label: "Email", render: (u) => <span className="text-text-muted">{u.email}</span> },
    { key: "created_at", label: "Joined", hideBelow: "lg", render: (u) => new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
  ];
  const rows = list.map((u, i) => ({ ...u, _n: (listPage - 1) * LIST_LIMIT + i + 1 }));

  return (
    <div className="space-y-6">
      <PageHeader
        size="sm"
        title="Early Adopters"
        subtitle={`First ${stats?.capacity?.toLocaleString() ?? "5,000"} registered users receive lifetime Premium`}
        actions={<Button variant="secondary" size="sm" icon={RefreshIcon} onClick={refresh} loading={loading}>Refresh</Button>}
      />
      {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}

      <div className="rounded-2xl border border-border/50 bg-surface p-4 sm:p-6">
        {loading && !stats ? (
          <Skeleton className="h-28" />
        ) : stats ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-2">
              <span className="text-4xl font-bold tabular-nums text-white">{stats.count.toLocaleString()}</span>
              <span className="mb-1 text-lg text-text-faint">/ {stats.capacity.toLocaleString()}</span>
              <span className={`mb-1 ml-auto text-sm font-semibold ${isFull ? "text-rose-400" : "text-text-muted"}`}>{isFull ? "Pool full" : `${stats.remaining.toLocaleString()} remaining`}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-3">
              <div className={`h-full rounded-full transition-all duration-500 ${isFull ? "bg-rose-500" : "bg-brand"}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Claimed" value={stats.count.toLocaleString()} />
              <StatCard label="Capacity" value={stats.capacity.toLocaleString()} />
              <StatCard label="Remaining" value={isFull ? "—" : stats.remaining.toLocaleString()} tone={isFull ? "text-text-faint" : undefined} />
            </div>
            {isFull && <ErrorNote inline>The early adopter pool is full. New registrations no longer receive the lifetime Premium grant.</ErrorNote>}
          </div>
        ) : null}
      </div>

      <section>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-text-faint">All early adopters — {listTotal.toLocaleString()}</p>
        {listError && <ErrorNote className="mb-3">{listError}</ErrorNote>}
        <DataTable columns={columns} rows={rows} rowKey={(u) => u.id} loading={listLoading} emptyTitle="No early adopters yet." dense />
        <Pager page={listPage} totalPages={totalPages} onPage={fetchList} loading={listLoading} />
      </section>
    </div>
  );
}

export default EarlyAdoptersPage;
