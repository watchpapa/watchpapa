import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuditLog } from "../../features/admin/hooks/useAuditLog.js";
import PageHeader from "../../components/ui/PageHeader.jsx";
import PillTabs from "../../components/ui/PillTabs.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Select from "../../components/ui/Select.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Modal from "../../components/ui/Modal.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import DataTable from "../../components/ui/DataTable.jsx";

const EMPTY = { action: "", email: "", user_id: "", path: "", source: "", from: "", to: "" };
const AUTH_VARIANT = { login: "success", logout: "neutral", user_signedup: "brand", user_updated_password: "warning", user_recovery_requested: "warning", user_deleted: "danger", token_revoked: "danger" };

function Field({ label, value, mono }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-text-faint">{label}</p>
      <p className={`break-all text-sm text-text ${mono ? "font-mono" : ""}`}>{String(value)}</p>
    </div>
  );
}

function AuditLogPage() {
  const { events, total, loading, error, fetch, registry } = useAuditLog();
  const [searchParams] = useSearchParams();
  const initialUser = searchParams.get("user_id") ?? "";
  const [kind, setKind] = useState("app");
  const [page, setPage] = useState(1);
  const limit = 50;
  const [filters, setFilters] = useState({ ...EMPTY, user_id: initialUser });
  const [applied, setApplied] = useState({ ...EMPTY, user_id: initialUser });
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetch({ kind: "app", page: 1, limit, user_id: initialUser }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const actionMeta = useMemo(() => {
    const m = new Map();
    for (const a of registry?.actions ?? []) m.set(a.action, a);
    return m;
  }, [registry]);
  const groupColor = useMemo(() => Object.fromEntries((registry?.groups ?? []).map((g) => [g.key, g.color])), [registry]);

  function run(nextFilters, nextPage = 1, nextKind = kind) {
    setApplied(nextFilters);
    setPage(nextPage);
    fetch({ kind: nextKind, page: nextPage, limit, ...nextFilters });
  }
  function switchKind(k) {
    setKind(k);
    const next = { ...EMPTY, user_id: k === "app" ? filters.user_id : "" };
    setFilters(next);
    run(next, 1, k);
  }

  const hasFilters = Object.values(applied).some(Boolean);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const ActionBadge = ({ action }) => {
    const meta = actionMeta.get(action);
    const variant = kind === "auth" ? AUTH_VARIANT[action] ?? "info" : groupColor[meta?.group] ?? "neutral";
    return <Badge variant={variant} size="xs" className="font-mono" title={meta?.label}>{action}</Badge>;
  };

  const actionOptions = kind === "auth"
    ? [{ value: "", label: "All auth events" }, ...(registry?.authActions ?? []).map((a) => ({ value: a, label: a }))]
    : [{ value: "", label: "All actions" }, ...(registry?.groups ?? []).flatMap((g) => (registry?.actions ?? []).filter((a) => a.group === g.key).map((a) => ({ value: a.action, label: `${g.label} · ${a.label}` })))];

  const columns = kind === "auth"
    ? [
        { key: "created_at", label: "Time", render: (ev) => <span className="whitespace-nowrap text-xs tabular-nums text-text-dim">{new Date(ev.created_at).toLocaleString()}</span> },
        { key: "action", label: "Event", primary: true, render: (ev) => <ActionBadge action={ev.action} /> },
        { key: "email", label: "Email", render: (ev) => <span className="text-xs text-text-muted">{ev.email ?? "—"}</span> },
        { key: "username", label: "Username", hideBelow: "lg", render: (ev) => <span className="text-xs text-text-dim">{ev.username ? `@${ev.username}` : "—"}</span> },
        { key: "provider", label: "Provider", hideBelow: "xl", render: (ev) => <span className="text-xs text-text-dim">{ev.provider ?? (ev.via_sso ? "sso" : "—")}</span> },
        { key: "ip", label: "IP", hideBelow: "xl", cardHidden: true, render: (ev) => <span className="font-mono text-xs text-text-faint">{ev.ip}</span> },
      ]
    : [
        { key: "created_at", label: "Time", render: (ev) => <span className="whitespace-nowrap text-xs tabular-nums text-text-dim">{new Date(ev.created_at).toLocaleString()}</span> },
        { key: "action", label: "Action", primary: true, render: (ev) => <span className="flex flex-wrap items-center gap-1"><ActionBadge action={ev.action} />{ev.status >= 400 && <Badge variant="danger" size="xs">{ev.status}</Badge>}</span> },
        { key: "username", label: "Who", render: (ev) => <span className="text-xs text-text-muted">{ev.username ? `@${ev.username}` : ev.email ?? "—"}</span> },
        { key: "target", label: "Target", hideBelow: "lg", render: (ev) => <span className="text-xs text-text-dim">{ev.target_username ? `@${ev.target_username}` : ev.target_user_id ? ev.target_user_id.slice(0, 8) + "…" : "—"}</span> },
        { key: "source", label: "Source", hideBelow: "xl", render: (ev) => <Badge size="xs">{ev.source}</Badge> },
        { key: "path", label: "Path", hideBelow: "lg", render: (ev) => <span className="block max-w-[220px] truncate font-mono text-xs text-text-dim">{ev.path}</span> },
        { key: "ip", label: "IP", hideBelow: "xl", cardHidden: true, render: (ev) => <span className="font-mono text-xs text-text-faint">{ev.ip ?? "—"}</span> },
      ];

  return (
    <div>
      <PageHeader
        size="sm"
        title="Audit Log"
        subtitle={applied.user_id ? `Events for user ${applied.user_id} · click a row for details` : "Every recorded user, admin and auth event · click a row for details"}
        actions={<PillTabs size="sm" aria-label="Log" tabs={[{ value: "app", label: "App events" }, { value: "auth", label: "Auth events" }]} value={kind} onChange={switchKind} />}
      />

      <form onSubmit={(e) => { e.preventDefault(); run(filters); }} className="mb-5 grid grid-cols-1 gap-2 xs:grid-cols-2 lg:grid-cols-4 xl:flex xl:flex-wrap xl:items-end">
        <Select size="md" value={filters.action} onChange={(v) => setFilters((f) => ({ ...f, action: v }))} options={actionOptions} aria-label="Action" className="xs:col-span-2 lg:col-span-2 xl:w-72" />
        <Input size="md" placeholder={kind === "auth" ? "Email…" : "Email or username…"} value={filters.email} onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))} className="h-10 xl:w-52" aria-label="Email or username" />
        {kind === "app" && (
          <>
            <Input size="md" placeholder="User id (actor or target)" value={filters.user_id} onChange={(e) => setFilters((f) => ({ ...f, user_id: e.target.value }))} className="h-10 font-mono text-xs xl:w-72" aria-label="User id" />
            <Input size="md" placeholder="Path contains…" value={filters.path} onChange={(e) => setFilters((f) => ({ ...f, path: e.target.value }))} className="h-10 xl:w-48" aria-label="Path" />
            <Select size="md" value={filters.source} onChange={(v) => setFilters((f) => ({ ...f, source: v }))} options={[{ value: "", label: "Any source" }, { value: "worker", label: "Worker" }, { value: "db", label: "Database" }]} aria-label="Source" className="xl:w-36" />
          </>
        )}
        <Input size="md" type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="h-10 xl:w-40" aria-label="From" />
        <Input size="md" type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="h-10 xl:w-40" aria-label="To" />
        <div className="flex gap-2 xs:col-span-2 lg:col-span-4 xl:col-auto">
          <Button type="submit" size="md" loading={loading} className="flex-1 xl:flex-none">Filter</Button>
          {hasFilters && <Button type="button" variant="outline" size="md" onClick={() => { setFilters(EMPTY); run(EMPTY); }}>Clear</Button>}
        </div>
      </form>

      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      <DataTable columns={columns} rows={events} rowKey={(ev) => `${kind}-${ev.id}`} loading={loading} onRowClick={setSelected} emptyTitle="No events found." dense />

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
            {actionMeta.get(selected.action) && <p className="text-sm text-text">{actionMeta.get(selected.action).label}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email" value={selected.email} />
              <Field label="Username" value={selected.username ? `@${selected.username}` : null} />
              <Field label="User ID" value={selected.user_id} mono />
              <Field label="Target" value={selected.target_username ? `@${selected.target_username}` : selected.target_user_id} mono={!selected.target_username} />
              <Field label="IP" value={selected.ip} mono />
              <Field label="Method" value={selected.method} />
              <Field label="Path" value={selected.path} mono />
              <Field label="Status" value={selected.status} />
              <Field label="Source" value={selected.source} />
              <Field label="Provider" value={selected.provider} />
            </div>
            {selected.user_id && kind === "app" && (
              <Button variant="ghost" size="xs" to={`/admin/users?q=${selected.email ?? ""}`}>Open in User Lookup</Button>
            )}
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
