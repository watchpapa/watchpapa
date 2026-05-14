import { useCallback, useEffect, useState } from "react";
import { useRewardCodes } from "../../features/admin/hooks/useRewardCodes.js";

const TIERS = ["premium", "pro", "pro_plus"];
const TIER_LABELS = { premium: "Premium", pro: "Pro", pro_plus: "Pro+" };
const STATUS_TABS = ["all", "active", "expired", "depleted", "inactive"];

const STATUS_BADGE = {
  active:   "bg-emerald-900/40 text-emerald-400 border-emerald-700/50",
  expired:  "bg-amber-900/40 text-amber-400 border-amber-700/50",
  depleted: "bg-[#1a1f3a] text-[#6868b8] border-[#2a3570]",
  inactive: "bg-[#1a1f3a] text-[#5a5a78] border-[#1a1f3a]",
};

const EMPTY_FORM = { tier: "premium", durationDays: 30, maxUses: 1, expiresAt: "" };

function FieldLabel({ children }) {
  return <span className="text-[10px] uppercase tracking-wider text-[#5a5a78]">{children}</span>;
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      className="rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1.5 text-sm text-white outline-none focus:border-[#6868b8] placeholder-[#4a4a8a] w-full"
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1.5 text-sm text-white outline-none focus:border-[#6868b8] w-full"
    >
      {children}
    </select>
  );
}

function FormFields({ form, onChange }) {
  return (
    <>
      <label className="flex flex-col gap-1">
        <FieldLabel>Tier</FieldLabel>
        <Select value={form.tier} onChange={(e) => onChange("tier", e.target.value)}>
          {TIERS.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
        </Select>
      </label>
      <label className="flex flex-col gap-1">
        <FieldLabel>Duration (days)</FieldLabel>
        <Input type="number" min="1" placeholder="blank = lifetime" value={form.durationDays} onChange={(e) => onChange("durationDays", e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <FieldLabel>Max uses/code</FieldLabel>
        <Input type="number" min="1" placeholder="blank = unlimited" value={form.maxUses} onChange={(e) => onChange("maxUses", e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <FieldLabel>Code expiry</FieldLabel>
        <Input type="date" value={form.expiresAt} onChange={(e) => onChange("expiresAt", e.target.value)} />
      </label>
    </>
  );
}

function RewardCodesPage() {
  const { codes, total, isLoading, error, fetchCodes, generateCodes, createCustomCode, toggleActive, editCode, deleteCode, fetchClaims, exportCsv } = useRewardCodes();

  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 50;

  const reload = useCallback(() => fetchCodes({ page, limit, status: statusFilter }), [fetchCodes, page, statusFilter]);
  useEffect(() => { reload(); }, [reload]);

  // Generate panel
  const [genMode, setGenMode] = useState("random"); // "random" | "custom"
  const [genForm, setGenForm] = useState({ ...EMPTY_FORM, count: 10 });
  const [customForm, setCustomForm] = useState({ ...EMPTY_FORM, code: "" });
  const [genResult, setGenResult] = useState(null);
  const [genError, setGenError] = useState(null);
  const [generating, setGenerating] = useState(false);

  const setField = (setter) => (key, val) => setter((f) => ({ ...f, [key]: val }));

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenError(null);
    setGenResult(null);
    setGenerating(true);
    try {
      const params = {
        tier: genForm.tier,
        durationDays: genForm.durationDays === "" ? null : Number(genForm.durationDays),
        maxUses: genForm.maxUses === "" ? null : Number(genForm.maxUses),
        expiresAt: genForm.expiresAt || null,
      };
      const result = await generateCodes({ count: Number(genForm.count), ...params });
      setGenResult(result);
      reload();
    } catch (e) {
      setGenError(e.message);
    }
    setGenerating(false);
  };

  const handleCreateCustom = async (e) => {
    e.preventDefault();
    setGenError(null);
    setGenResult(null);
    setGenerating(true);
    try {
      const created = await createCustomCode({
        code: customForm.code.trim().toUpperCase(),
        tier: customForm.tier,
        durationDays: customForm.durationDays === "" ? null : Number(customForm.durationDays),
        maxUses: customForm.maxUses === "" ? null : Number(customForm.maxUses),
        expiresAt: customForm.expiresAt || null,
      });
      setGenResult([created]);
      setCustomForm({ ...EMPTY_FORM, code: "" });
      reload();
    } catch (e) {
      setGenError(e.message);
    }
    setGenerating(false);
  };

  const downloadGenerated = () => {
    if (!genResult?.length) return;
    const header = "code,tier,duration_days,max_uses\n";
    const rows = genResult.map((c) => `${c.code},${c.tier},${c.duration_days ?? ""},${c.max_uses ?? ""}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Edit modal
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  const openEdit = (code) => {
    setEditTarget(code);
    setEditForm({
      tier: code.tier,
      durationDays: code.duration_days ?? "",
      maxUses: code.max_uses ?? "",
      expiresAt: code.expires_at ? code.expires_at.slice(0, 10) : "",
      isActive: code.is_active,
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError(null);
    try {
      await editCode(editTarget.id, {
        tier: editForm.tier,
        durationDays: editForm.durationDays === "" ? null : Number(editForm.durationDays),
        maxUses: editForm.maxUses === "" ? null : Number(editForm.maxUses),
        expiresAt: editForm.expiresAt || null,
        isActive: editForm.isActive,
      });
      setEditTarget(null);
      reload();
    } catch (e) {
      setEditError(e.message);
    }
    setEditSaving(false);
  };

  // Delete confirmation (per-row inline)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleDelete = async (code) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCode(code.id);
      setDeleteTarget(null);
      reload();
    } catch (e) {
      setDeleteError(e.message);
    }
    setDeleting(false);
  };

  // Claims drawer
  const [claimsDrawer, setClaimsDrawer] = useState(null);
  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(false);

  const openClaims = async (code) => {
    setClaimsDrawer(code);
    setClaimsLoading(true);
    setClaims(await fetchClaims(code.id));
    setClaimsLoading(false);
  };

  const handleToggle = async (code) => {
    await toggleActive(code.id, !code.is_active);
    reload();
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-white">Reward Codes</h1>

      {/* Create panel */}
      <section className="rounded-2xl border border-[#1a1f3a] bg-[#0a0c18] p-5">
        {/* Mode tabs */}
        <div className="mb-4 flex gap-1">
          {[["random", "Generate random"], ["custom", "Create custom"]].map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => { setGenMode(mode); setGenError(null); setGenResult(null); }}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${genMode === mode ? "bg-[#1a1d35] text-white" : "text-[#6868b8] hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {genMode === "random" ? (
          <form onSubmit={handleGenerate} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <FormFields form={genForm} onChange={setField(setGenForm)} />
            <label className="flex flex-col gap-1">
              <FieldLabel>Count</FieldLabel>
              <Input type="number" min="1" max="1000" value={genForm.count} onChange={(e) => setGenForm((f) => ({ ...f, count: e.target.value }))} />
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={generating} className="w-full rounded-lg border border-[#6868b8] bg-[#12163a] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#9b9bf0] hover:text-white disabled:opacity-50">
                {generating ? "Generating…" : "Generate"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateCustom} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <label className="col-span-2 sm:col-span-1 flex flex-col gap-1">
              <FieldLabel>Code name</FieldLabel>
              <Input
                type="text"
                placeholder="e.g. SUMMER25"
                value={customForm.code}
                onChange={(e) => setCustomForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                required
              />
            </label>
            <FormFields form={customForm} onChange={setField(setCustomForm)} />
            <div className="flex items-end">
              <button type="submit" disabled={generating || !customForm.code.trim()} className="w-full rounded-lg border border-[#6868b8] bg-[#12163a] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#9b9bf0] hover:text-white disabled:opacity-50">
                {generating ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        )}

        {genError && <p className="mt-2 text-xs text-red-400">{genError}</p>}
        {genResult && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-emerald-400 font-semibold">
                {genResult.length} code{genResult.length !== 1 ? "s" : ""} created
              </p>
              {genResult.length > 1 && (
                <button onClick={downloadGenerated} className="text-xs text-[#9b9bf0] underline hover:text-white transition">Download CSV</button>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-[#1a1f3a] bg-[#06070f] p-2">
              <table className="w-full text-xs font-mono">
                <tbody>
                  {genResult.map((c) => (
                    <tr key={c.code}>
                      <td className="py-0.5 pr-4 text-white">{c.code}</td>
                      <td className="pr-4 text-[#8080a8]">{TIER_LABELS[c.tier]}</td>
                      <td className="text-[#5a5a78]">{c.duration_days ? `${c.duration_days}d` : "lifetime"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Codes table */}
      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} className={`rounded-lg px-3 py-1 text-xs font-semibold transition capitalize ${statusFilter === s ? "bg-[#141728] text-white" : "text-[#6868b8] hover:text-white"}`}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={() => exportCsv(statusFilter)} className="self-start text-xs text-[#9b9bf0] underline hover:text-white transition sm:self-auto">Export CSV</button>
        </div>

        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

        <div className="overflow-x-auto rounded-2xl border border-[#1a1f3a]">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-[#1a1f3a] text-[10px] uppercase tracking-wider text-[#5a5a78]">
                {["Code", "Tier", "Duration", "Uses", "Expiry", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="py-10 text-center text-[#5a5a78]">Loading…</td></tr>
              ) : codes.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-[#5a5a78]">No codes found.</td></tr>
              ) : codes.map((c) => (
                <tr key={c.id} className="border-b border-[#1a1f3a] last:border-0 hover:bg-[#0a0c18] transition">
                  <td className="px-4 py-3 font-mono text-white">{c.code}</td>
                  <td className="px-4 py-3 text-[#c0c0e8]">{TIER_LABELS[c.tier] ?? c.tier}</td>
                  <td className="px-4 py-3 text-[#8080a8]">{c.duration_days ? `${c.duration_days}d` : "Lifetime"}</td>
                  <td className="px-4 py-3 text-[#8080a8]">{c.current_uses}/{c.max_uses ?? "∞"}</td>
                  <td className="px-4 py-3 text-[#8080a8]">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_BADGE[c.status] ?? ""}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-[#5a5a78]">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {deleteTarget?.id === c.id ? (
                      <div className="flex flex-col gap-1">
                        {deleteError && <p className="text-[10px] text-red-400">{deleteError}</p>}
                        <div className="flex gap-2">
                          <button onClick={() => handleDelete(c)} disabled={deleting} className="text-xs font-semibold text-red-400 hover:text-red-300 transition disabled:opacity-50">
                            {deleting ? "Deleting…" : "Confirm"}
                          </button>
                          <button onClick={() => { setDeleteTarget(null); setDeleteError(null); }} className="text-xs text-[#6868b8] hover:text-white transition">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button onClick={() => handleToggle(c)} className="text-xs text-[#8080a8] underline hover:text-white transition">
                          {c.is_active ? "Disable" : "Enable"}
                        </button>
                        <button onClick={() => openEdit(c)} className="text-xs text-[#8080a8] underline hover:text-white transition">Edit</button>
                        <button onClick={() => openClaims(c)} className="text-xs text-[#8080a8] underline hover:text-white transition">Claims</button>
                        <button onClick={() => { setDeleteTarget(c); setDeleteError(null); }} className="text-xs text-red-500/70 underline hover:text-red-400 transition">Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[#2a3570] px-3 py-1 text-xs text-[#8080a8] disabled:opacity-40 hover:border-[#6868b8] hover:text-white transition">Prev</button>
            <span className="text-xs text-[#5a5a78]">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[#2a3570] px-3 py-1 text-xs text-[#8080a8] disabled:opacity-40 hover:border-[#6868b8] hover:text-white transition">Next</button>
          </div>
        )}
      </section>

      {/* Edit modal */}
      {editTarget && editForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={() => setEditTarget(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-[#2a3570] bg-[#0d0f1e] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-bold text-white">Edit <span className="font-mono">{editTarget.code}</span></p>
              <button onClick={() => setEditTarget(null)} className="text-[#5a5a78] hover:text-white transition">✕</button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <FieldLabel>Tier</FieldLabel>
                  <Select value={editForm.tier} onChange={(e) => setEditForm((f) => ({ ...f, tier: e.target.value }))}>
                    {TIERS.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
                  </Select>
                </label>
                <label className="flex flex-col gap-1">
                  <FieldLabel>Duration (days)</FieldLabel>
                  <Input type="number" min="1" placeholder="blank = lifetime" value={editForm.durationDays} onChange={(e) => setEditForm((f) => ({ ...f, durationDays: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1">
                  <FieldLabel>Max uses</FieldLabel>
                  <Input type="number" min="1" placeholder="blank = unlimited" value={editForm.maxUses} onChange={(e) => setEditForm((f) => ({ ...f, maxUses: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1">
                  <FieldLabel>Code expiry</FieldLabel>
                  <Input type="date" value={editForm.expiresAt} onChange={(e) => setEditForm((f) => ({ ...f, expiresAt: e.target.value }))} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-[#c0c0e8]">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="accent-[#6868b8]"
                />
                Active
              </label>
              {editError && <p className="text-xs text-red-400">{editError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditTarget(null)} className="rounded-lg border border-[#2a3570] px-3 py-1.5 text-xs text-[#6868b8] transition hover:text-white">Cancel</button>
                <button type="submit" disabled={editSaving} className="rounded-lg border border-[#6868b8] bg-[#12163a] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#9b9bf0] hover:text-white disabled:opacity-50">
                  {editSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Claims drawer */}
      {claimsDrawer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={() => setClaimsDrawer(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-[#2a3570] bg-[#0d0f1e] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-bold text-white">Claims for <span className="font-mono">{claimsDrawer.code}</span></p>
              <button onClick={() => setClaimsDrawer(null)} className="text-[#5a5a78] hover:text-white transition">✕</button>
            </div>
            {claimsLoading ? (
              <p className="text-sm text-[#5a5a78]">Loading…</p>
            ) : claims.length === 0 ? (
              <p className="text-sm text-[#5a5a78]">No claims yet.</p>
            ) : (
              <ul className="space-y-2">
                {claims.map((c) => (
                  <li key={c.profile_id} className="flex justify-between text-sm">
                    <span className="font-semibold text-white">{c.username}</span>
                    <span className="text-[#5a5a78]">{new Date(c.claimed_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default RewardCodesPage;
