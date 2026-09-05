import { useCallback, useEffect, useRef, useState } from "react";
import { useRewardCodes } from "../../features/admin/hooks/useRewardCodes.js";
import PageHeader from "../../components/ui/PageHeader.jsx";
import PillTabs from "../../components/ui/PillTabs.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Select from "../../components/ui/Select.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Modal from "../../components/ui/Modal.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import { DownloadIcon } from "../../components/icons/index.jsx";

const TIERS = ["premium", "pro", "pro_plus"];
const TIER_LABELS = { premium: "Premium", pro: "Pro", pro_plus: "Pro+" };
const STATUS_TABS = ["all", "active", "expired", "depleted", "inactive"];
const STATUS_VARIANT = { active: "success", expired: "warning", depleted: "neutral", inactive: "neutral" };
const EMPTY_FORM = { tier: "premium", durationDays: 30, maxUses: 1, expiresAt: "" };

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-text-faint">{label}</span>
      {children}
    </label>
  );
}

function FormFields({ form, onChange }) {
  return (
    <>
      <Field label="Tier"><Select size="sm" value={form.tier} onChange={(v) => onChange("tier", v)} options={TIERS.map((t) => ({ value: t, label: TIER_LABELS[t] }))} full /></Field>
      <Field label="Duration (days)"><Input size="md" type="number" min="1" placeholder="blank = lifetime" value={form.durationDays} onChange={(e) => onChange("durationDays", e.target.value)} className="h-9 text-xs" /></Field>
      <Field label="Max uses/code"><Input size="md" type="number" min="1" placeholder="blank = unlimited" value={form.maxUses} onChange={(e) => onChange("maxUses", e.target.value)} className="h-9 text-xs" /></Field>
      <Field label="Code expiry"><Input size="md" type="date" value={form.expiresAt} onChange={(e) => onChange("expiresAt", e.target.value)} className="h-9 text-xs" /></Field>
    </>
  );
}

function downloadCsv(name, header, lines) {
  const url = URL.createObjectURL(new Blob([header + lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function RewardCodesPage() {
  const { codes, total, isLoading, error, fetchCodes, generateCodes, createCustomCode, toggleActive, editCode, deleteCode, fetchClaims, exportCsv, bulkAction } = useRewardCodes();

  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 50;

  // Selection
  const [selected, setSelected] = useState(new Set());
  const selectAllRef = useRef(null);
  const toggleSelect = (id) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleSelectAll = () => setSelected(selected.size === codes.length ? new Set() : new Set(codes.map((c) => c.id)));
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selected.size > 0 && selected.size < codes.length;
  }, [selected, codes]);

  const reload = useCallback(() => fetchCodes({ page, limit, status: statusFilter }), [fetchCodes, page, statusFilter]);
  useEffect(() => { reload(); }, [reload]);
  const changeFilter = (s) => { setStatusFilter(s); setPage(1); setSelected(new Set()); };
  const changePage = (p) => { setPage(p); setSelected(new Set()); };

  // Bulk
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const handleBulk = async (action) => {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === "delete" && !window.confirm(`Delete ${ids.length} code(s)? This cannot be undone.`)) return;
    setBulkBusy(true);
    setBulkError(null);
    try { await bulkAction(action, ids); setSelected(new Set()); reload(); } catch (e) { setBulkError(e.message); }
    setBulkBusy(false);
  };
  const exportSelected = () => {
    const rows = codes.filter((c) => selected.has(c.id));
    if (!rows.length) return;
    downloadCsv("reward-codes-selected", "code,tier,duration_days,max_uses,current_uses,expires_at,is_active,status,created_at\n",
      rows.map((c) => [c.code, c.tier, c.duration_days ?? "", c.max_uses ?? "", c.current_uses, c.expires_at ?? "", c.is_active, c.status, c.created_at].join(",")));
  };

  // Generate / create
  const [genMode, setGenMode] = useState("random");
  const [genForm, setGenForm] = useState({ ...EMPTY_FORM, count: 10 });
  const [customForm, setCustomForm] = useState({ ...EMPTY_FORM, code: "" });
  const [genResult, setGenResult] = useState(null);
  const [genError, setGenError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const setField = (setter) => (key, val) => setter((f) => ({ ...f, [key]: val }));
  const toParams = (f) => ({ tier: f.tier, durationDays: f.durationDays === "" ? null : Number(f.durationDays), maxUses: f.maxUses === "" ? null : Number(f.maxUses), expiresAt: f.expiresAt || null });

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenError(null); setGenResult(null); setGenerating(true);
    try { setGenResult(await generateCodes({ count: Number(genForm.count), ...toParams(genForm) })); reload(); } catch (err) { setGenError(err.message); }
    setGenerating(false);
  };
  const handleCreateCustom = async (e) => {
    e.preventDefault();
    setGenError(null); setGenResult(null); setGenerating(true);
    try {
      const created = await createCustomCode({ code: customForm.code.trim().toUpperCase(), ...toParams(customForm) });
      setGenResult([created]);
      setCustomForm({ ...EMPTY_FORM, code: "" });
      reload();
    } catch (err) { setGenError(err.message); }
    setGenerating(false);
  };
  const downloadGenerated = () => genResult?.length && downloadCsv("generated-codes", "code,tier,duration_days,max_uses\n", genResult.map((c) => `${c.code},${c.tier},${c.duration_days ?? ""},${c.max_uses ?? ""}`));

  // Edit
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const openEdit = (code) => {
    setEditTarget(code);
    setEditForm({ tier: code.tier, durationDays: code.duration_days ?? "", maxUses: code.max_uses ?? "", expiresAt: code.expires_at ? code.expires_at.slice(0, 10) : "", isActive: code.is_active });
    setEditError(null);
  };
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true); setEditError(null);
    try { await editCode(editTarget.id, { ...toParams(editForm), isActive: editForm.isActive }); setEditTarget(null); reload(); } catch (err) { setEditError(err.message); }
    setEditSaving(false);
  };

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const handleDelete = async () => {
    setDeleting(true); setDeleteError(null);
    try { await deleteCode(deleteTarget.id); setDeleteTarget(null); reload(); } catch (err) { setDeleteError(err.message); }
    setDeleting(false);
  };

  // Claims
  const [claimsDrawer, setClaimsDrawer] = useState(null);
  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const openClaims = async (code) => { setClaimsDrawer(code); setClaimsLoading(true); setClaims(await fetchClaims(code.id)); setClaimsLoading(false); };

  const handleToggle = async (code) => { await toggleActive(code.id, !code.is_active); reload(); };
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const actions = (c) => (
    <>
      <Button variant="ghost" size="xs" onClick={() => handleToggle(c)}>{c.is_active ? "Disable" : "Enable"}</Button>
      <Button variant="ghost" size="xs" onClick={() => openEdit(c)}>Edit</Button>
      <Button variant="ghost" size="xs" onClick={() => openClaims(c)}>Claims</Button>
      <Button variant="ghost" size="xs" onClick={() => { setDeleteTarget(c); setDeleteError(null); }} className="text-red-300 hover:text-red-200">Delete</Button>
    </>
  );

  const columns = [
    {
      key: "select", label: <input ref={selectAllRef} type="checkbox" checked={codes.length > 0 && selected.size === codes.length} onChange={toggleSelectAll} className="h-4 w-4 cursor-pointer accent-brand" aria-label="Select all" />,
      render: (c) => <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 cursor-pointer accent-brand" aria-label={`Select ${c.code}`} />,
      className: "w-10", cardHidden: true,
    },
    { key: "code", label: "Code", primary: true, render: (c) => <span className="font-mono text-white">{c.code}</span> },
    { key: "tier", label: "Tier", render: (c) => TIER_LABELS[c.tier] ?? c.tier },
    { key: "duration", label: "Duration", render: (c) => (c.duration_days ? `${c.duration_days}d` : "Lifetime") },
    { key: "uses", label: "Uses", render: (c) => `${c.current_uses}/${c.max_uses ?? "∞"}` },
    { key: "expiry", label: "Expiry", hideBelow: "lg", render: (c) => (c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—") },
    { key: "status", label: "Status", render: (c) => <Badge variant={STATUS_VARIANT[c.status] ?? "neutral"} size="xs" className="capitalize">{c.status}</Badge> },
    { key: "created", label: "Created", hideBelow: "xl", render: (c) => new Date(c.created_at).toLocaleDateString() },
    { key: "actions", label: "Actions", cardHidden: true, render: (c) => <div className="flex flex-wrap gap-1">{actions(c)}</div> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader size="sm" title="Reward Codes" subtitle="Generate promo codes, manage their status and see who claimed them." />

      <section className="rounded-2xl border border-border/50 bg-surface p-4 sm:p-5">
        <PillTabs size="sm" aria-label="Create mode" className="mb-4 w-fit" tabs={[{ value: "random", label: "Generate random" }, { value: "custom", label: "Create custom" }]} value={genMode} onChange={(m) => { setGenMode(m); setGenError(null); setGenResult(null); }} />
        {genMode === "random" ? (
          <form onSubmit={handleGenerate} className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
            <FormFields form={genForm} onChange={setField(setGenForm)} />
            <Field label="Count"><Input size="md" type="number" min="1" max="1000" value={genForm.count} onChange={(e) => setGenForm((f) => ({ ...f, count: e.target.value }))} className="h-9 text-xs" /></Field>
            <div className="flex items-end"><Button type="submit" size="sm" full loading={generating}>Generate</Button></div>
          </form>
        ) : (
          <form onSubmit={handleCreateCustom} className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
            <Field label="Code name"><Input size="md" placeholder="e.g. SUMMER25" value={customForm.code} onChange={(e) => setCustomForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} required className="h-9 font-mono text-xs uppercase" /></Field>
            <FormFields form={customForm} onChange={setField(setCustomForm)} />
            <div className="flex items-end"><Button type="submit" size="sm" full loading={generating} disabled={!customForm.code.trim()}>Create</Button></div>
          </form>
        )}
        {genError && <ErrorNote inline className="mt-3">{genError}</ErrorNote>}
        {genResult && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-400">{genResult.length} code{genResult.length !== 1 ? "s" : ""} created</p>
              {genResult.length > 1 && <Button variant="ghost" size="xs" icon={DownloadIcon} onClick={downloadGenerated}>Download CSV</Button>}
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border/50 bg-bg p-2 font-mono text-xs">
              {genResult.map((c) => (
                <div key={c.code} className="flex gap-4 py-0.5"><span className="text-white">{c.code}</span><span className="text-text-muted">{TIER_LABELS[c.tier]}</span><span className="text-text-faint">{c.duration_days ? `${c.duration_days}d` : "lifetime"}</span></div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <PillTabs size="sm" aria-label="Status" tabs={STATUS_TABS.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} value={statusFilter} onChange={changeFilter} className="w-fit max-w-full" />
          <Button variant="ghost" size="xs" icon={DownloadIcon} onClick={() => exportCsv(statusFilter)} className="self-start sm:self-auto">Export CSV</Button>
        </div>
        {error && <ErrorNote className="mb-3">{error}</ErrorNote>}

        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <span className="text-xs font-semibold text-white">{selected.size} selected</span>
            <Button variant="ghost" size="xs" onClick={() => setSelected(new Set())}>Clear</Button>
            <span className="mx-1 h-4 w-px bg-border" />
            <Button variant="success" size="xs" onClick={() => handleBulk("enable")} disabled={bulkBusy}>Enable</Button>
            <Button variant="outline" size="xs" onClick={() => handleBulk("disable")} disabled={bulkBusy}>Disable</Button>
            <Button variant="outline" size="xs" onClick={exportSelected}>Export CSV</Button>
            <Button variant="danger" size="xs" onClick={() => handleBulk("delete")} loading={bulkBusy}>Delete</Button>
            {bulkError && <span className="text-xs text-red-300">{bulkError}</span>}
          </div>
        )}

        <DataTable columns={columns} rows={codes} rowKey={(c) => c.id} loading={isLoading} emptyTitle="No codes found." dense cardActions={(c) => (
          <>
            <label className="mr-auto flex items-center gap-2 text-xs text-text-muted"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="h-4 w-4 accent-brand" /> Select</label>
            {actions(c)}
          </>
        )} />

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-text-faint">
            <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => changePage(page - 1)}>Prev</Button>
            <span>{page} / {totalPages}</span>
            <Button variant="outline" size="xs" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next</Button>
          </div>
        )}
      </section>

      <Modal open={!!(editTarget && editForm)} onClose={() => setEditTarget(null)} title={editTarget ? `Edit ${editTarget.code}` : ""} size="md"
        footer={editTarget && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button size="sm" form="edit-code-form" type="submit" loading={editSaving}>Save</Button>
          </div>
        )}>
        {editForm && (
          <form id="edit-code-form" onSubmit={handleSaveEdit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2"><FormFields form={editForm} onChange={setField(setEditForm)} /></div>
            <label className="flex items-center gap-2 text-sm text-text"><input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} className="h-4 w-4 accent-brand" /> Active</label>
            {editError && <ErrorNote inline>{editError}</ErrorNote>}
          </form>
        )}
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete code?" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>Delete</Button>
          </div>
        }>
        <p className="text-sm text-text">Permanently delete <span className="font-mono text-white">{deleteTarget?.code}</span>? This cannot be undone.</p>
        {deleteError && <ErrorNote inline className="mt-3">{deleteError}</ErrorNote>}
      </Modal>

      <Modal open={!!claimsDrawer} onClose={() => setClaimsDrawer(null)} title={claimsDrawer ? `Claims for ${claimsDrawer.code}` : ""} size="sm">
        {claimsLoading ? (
          <p className="text-sm text-text-faint">Loading…</p>
        ) : claims.length === 0 ? (
          <p className="text-sm text-text-faint">No claims yet.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {claims.map((c) => (
              <li key={c.profile_id} className="flex justify-between py-2 text-sm"><span className="font-semibold text-white">{c.username}</span><span className="text-text-faint">{new Date(c.claimed_at).toLocaleDateString()}</span></li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

export default RewardCodesPage;
