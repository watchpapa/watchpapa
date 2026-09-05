import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuditLog } from "../../features/admin/hooks/useAuditLog.js";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Select from "../../components/ui/Select.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Modal from "../../components/ui/Modal.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import DataTable from "../../components/ui/DataTable.jsx";

// NOTE: the action list is still hard-coded here; phase 8 of the redesign
// replaces it with the Worker's action registry.
const ACTIONS = ["referral", "rewards", "follow_movie", "unfollow_movie", "follow_show", "unfollow_show"];
const ACTION_VARIANT = { referral: "info", rewards: "success", follow_movie: "brand", follow_show: "brand" };

function ActionBadge({ action }) {
  return <Badge variant={ACTION_VARIANT[action] ?? "neutral"} size="xs" className="font-mono">{action}</Badge>;
}

function Field({ label, value, mono }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-text-faint">{label}</p>
      <p className={`break-all text-sm text-text ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

const EMPTY = { action: "", email: "", from: "", to: "" };

function AuditLogPage() {
  const { events, total, loading, error, fetch } = useAuditLog();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const limit = 50;
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [selected, setSelected] = useState(null);
  const userIdParam = searchParams.get("user_id") ?? "";

  useEffect(() => { fetch({ page: 1, limit, user_id: userIdParam || undefined }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function run(next, nextPage = 1) {
    setApplied(next);
    setPage(nextPage);
    fetch({ page: nextPage, limit, ...next, user_id: userIdParam || undefined });
  }
  const hasFilters = Object.values(applied).some(Boolean);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const columns = [
    { key: "created_at", label: "Time", render: (ev) => <span className="whitespace-nowrap text-xs tabular-nums text-text-dim">{new Date(ev.created_at).toLocaleString()}</span> },
    { key: "action", label: "Action", primary: true, render: (ev) => <ActionBadge action={ev.action} /> },
    { key: "email", label: "Email", render: (ev) => <span className="text-xs text-text-muted">{ev.email ?? "—"}</span> },
    { key: "username", label: "Username", hideBelow: "lg", render: (ev) => <span className="text-xs text-text-dim">{ev.username ? `@${ev.username}` : "—"}</span> },
    { key: "method", label: "Method", hideBelow: "xl", render: (ev) => <span className="text-xs text-text-dim">{ev.method}</span> },
    { key: "path", label: "Path", hideBelow: "lg", render: (ev) => <span className="block max-w-[200px] truncate font-mono text-xs text-text-dim">{ev.path}</span> },
    { key: "ip", label: "IP", hideBelow: "xl", cardHidden: true, render: (ev) => <span className="font-mono text-xs text-text-faint">{ev.ip}</span> },
  ];

  return (
    <div>
      <PageHeader size="sm" title="Audit Log" subtitle={userIdParam ? `Events for user ${userIdParam} · click a row for details` : "All tracked user and system actions · click a row for details"} />

      <form onSubmit={(e) => { e.preventDefault(); run(filters); }} className="mb-5 grid grid-cols-1 gap-2 xs:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <Select size="md" value={filters.action} onChange={(v) => setFilters((f) => ({ ...f, action: v }))} options={[{ value: "", label: "All actions" }, ...ACTIONS.map((a) => ({ value: a, label: a }))]} aria-label="Action" className="lg:w-48" />
        <Input size="md" placeholder="Email filter…" value={filters.email} onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))} className="h-10 lg:w-56" aria-label="Email" />
        <Input size="md" type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="h-10 lg:w-40" aria-label="From" />
        <Input size="md" type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="h-10 lg:w-40" aria-label="To" />
        <div className="flex gap-2 xs:col-span-2 lg:col-auto">
          <Button type="submit" size="md" loading={loading} className="flex-1 lg:flex-none">Filter</Button>
          {hasFilters && <Button type="button" variant="outline" size="md" onClick={() => { setFilters(EMPTY); run(EMPTY); }}>Clear</Button>}
        </div>
      </form>

      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      <DataTable columns={columns} rows={events} rowKey={(ev) => ev.id} loading={loading} onRowClick={setSelected} emptyTitle="No events found." dense />

      <div className="mt-4 flex items-center justify-between text-xs text-text-dim">
        <span>{total.toLocaleString()} events</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs" onClick={() => run(applied, page - 1)} disabled={page <= 1 || loading}>← Prev</Button>
          <span className="text-text-faint">{page} / {totalPages}</span>
          <Button variant="outline" size="xs" onClick={() => run(applied, page + 1)} disabled={page >= totalPages || loading}>Next →</Button>
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? <span className="flex items-center gap-2"><ActionBadge action={selected.action} /><span className="text-xs text-text-faint">{new Date(selected.created_at).toLocaleString()}</span></span> : ""} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email" value={selected.email} />
              <Field label="Username" value={selected.username ? `@${selected.username}` : null} />
              <Field label="IP" value={selected.ip} mono />
              <Field label="Method" value={selected.method} />
              <Field label="Path" value={selected.path} mono />
              <Field label="User ID" value={selected.user_id} mono />
            </div>
            {(() => {
              const bodyStr = selected.body ? (typeof selected.body === "string" ? selected.body : JSON.stringify(selected.body, null, 2)) : null;
              return bodyStr && bodyStr !== "{}" && bodyStr !== "null" ? (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-text-faint">Body</p>
                  <pre className="whitespace-pre-wrap break-all rounded-xl border border-border/50 bg-bg p-3 text-xs text-text">{bodyStr}</pre>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AuditLogPage;
