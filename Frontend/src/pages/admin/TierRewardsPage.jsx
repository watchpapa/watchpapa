import { useCallback, useEffect, useState } from "react";
import { useTierRewards } from "../../features/admin/hooks/useTierRewards.js";
import PageHeader from "../../components/ui/PageHeader.jsx";
import PillTabs from "../../components/ui/PillTabs.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Select from "../../components/ui/Select.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Modal from "../../components/ui/Modal.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import { TIER_BADGE_VARIANTS, tierLabel } from "../../lib/tierMeta.js";
import { SearchIcon, XIcon, GiftIcon } from "../../components/icons/index.jsx";

const TIERS = ["premium", "pro", "pro_plus"];
const MESSAGE_MAX = 280;

function durationLabel(days) {
  return days ? `${days} day${days === 1 ? "" : "s"}` : "Lifetime";
}

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-text-faint">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-text-faint">{hint}</span>}
    </label>
  );
}

function UserPicker({ selected, onAdd, onRemove, searchUsers }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return undefined;
    let alive = true;
    const t = setTimeout(async () => {
      setSearching(true);
      setErr(null);
      try {
        const users = await searchUsers(q);
        if (alive) setResults(users);
      } catch (e) {
        if (alive) setErr(e.message);
      } finally {
        if (alive) setSearching(false);
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [query, searchUsers]);

  const onQueryChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    if (v.trim().length < 2) { setResults([]); setErr(null); }
  };

  const selectedIds = new Set(selected.map((u) => u.id));

  return (
    <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
      <Field label="Find users" hint="Search by email or username, then click to add.">
        <div className="relative">
          <SearchIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <Input
            size="md"
            value={query}
            onChange={onQueryChange}
            placeholder="Email or username…"
            className="h-9 pl-9 text-xs"
          />
        </div>
      </Field>

      {err && <ErrorNote inline>{err}</ErrorNote>}

      {query.trim().length >= 2 && (
        <div className="max-h-52 overflow-y-auto rounded-lg border border-border/50 bg-bg">
          {searching ? (
            <p className="px-3 py-3 text-xs text-text-faint">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-text-faint">No matches.</p>
          ) : (
            results.map((u) => {
              const already = selectedIds.has(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={already}
                  onClick={() => onAdd({ id: u.id, email: u.email, username: u.username })}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition hover:bg-surface-2 disabled:opacity-40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-white">{u.email}</span>
                    <span className="block truncate text-text-faint">@{u.username ?? "—"} · {tierLabel(u.tier ?? "free")}</span>
                  </span>
                  <span className="shrink-0 text-text-faint">{already ? "Added" : "Add"}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span key={u.id} className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-3 px-2 py-0.5 text-[11px] text-white">
              {u.username ? `@${u.username}` : u.email}
              <button type="button" onClick={() => onRemove(u.id)} aria-label={`Remove ${u.email}`} className="text-text-faint hover:text-white">
                <XIcon size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-[11px] text-text-faint">{selected.length} selected</p>
    </div>
  );
}

function TierRewardsPage() {
  const { batches, loading, error, fetchBatches, fetchEligibleCount, issueReward, searchUsers } = useTierRewards();

  const [tier, setTier] = useState("pro");
  const [days, setDays] = useState("30");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [selected, setSelected] = useState([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const addUser = useCallback((u) => setSelected((prev) => (prev.some((x) => x.id === u.id) ? prev : [...prev, u])), []);
  const removeUser = useCallback((id) => setSelected((prev) => prev.filter((u) => u.id !== id)), []);

  const parsedDays = days.trim() === "" ? null : Number(days);
  const daysInvalid = parsedDays !== null && (!Number.isInteger(parsedDays) || parsedDays < 1);
  const canSubmit =
    TIERS.includes(tier) &&
    !daysInvalid &&
    message.length <= MESSAGE_MAX &&
    (target === "all" || selected.length > 0);

  const openConfirm = async () => {
    setFormError(null);
    setResult(null);
    setConfirmOpen(true);
    if (target === "all") {
      setEstimating(true);
      setEstimate(null);
      try {
        setEstimate(await fetchEligibleCount(tier));
      } catch (e) {
        setFormError(e.message);
      } finally {
        setEstimating(false);
      }
    }
  };

  const handleIssue = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await issueReward({
        tier,
        durationDays: parsedDays,
        message: message.trim() || null,
        target,
        userIds: target === "selected" ? selected.map((u) => u.id) : undefined,
      });
      setResult(res);
      setConfirmOpen(false);
      setMessage("");
      setSelected([]);
      fetchBatches();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: "tier", label: "Tier", primary: true, render: (b) => <Badge variant={TIER_BADGE_VARIANTS[b.tier] ?? "neutral"} size="xs">{tierLabel(b.tier)}</Badge> },
    { key: "duration", label: "Duration", render: (b) => durationLabel(b.duration_days) },
    { key: "recipients", label: "Recipients", render: (b) => b.recipients },
    { key: "acknowledged", label: "Seen", render: (b) => `${b.acknowledged}/${b.recipients}` },
    { key: "message", label: "Message", hideBelow: "lg", render: (b) => b.message ? <span className="line-clamp-1 text-text-muted">{b.message}</span> : <span className="text-text-faint">—</span> },
    { key: "by", label: "Issued by", hideBelow: "xl", render: (b) => (b.granted_by_username ? `@${b.granted_by_username}` : "—") },
    { key: "when", label: "When", render: (b) => new Date(b.created_at).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <PageHeader size="sm" title="Tier Rewards" subtitle="Grant a higher plan to everyone or a chosen set of users. Each recipient sees a one-time popup and a notification." />

      <section className="rounded-2xl border border-border/50 bg-surface p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3">
          <Field label="Tier">
            <Select size="sm" value={tier} onChange={setTier} options={TIERS.map((t) => ({ value: t, label: tierLabel(t) }))} full />
          </Field>
          <Field label="Duration (days)" hint="Blank = lifetime">
            <Input size="md" type="number" min="1" placeholder="lifetime" value={days} onChange={(e) => setDays(e.target.value)} className="h-9 text-xs" aria-invalid={daysInvalid} />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Message (optional)" hint={`Shown in the popup. ${message.length}/${MESSAGE_MAX}`}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX + 20))}
              rows={2}
              placeholder="e.g. Thanks for helping test the beta."
              className="w-full rounded-xl border border-border-strong bg-surface-3/80 px-3.5 py-2 text-sm font-medium text-white placeholder:text-text-faint shadow-sm outline-none transition focus:border-brand-light focus:ring-1 focus:ring-brand"
            />
          </Field>
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-text-faint">Who gets it</span>
          <PillTabs
            size="sm"
            aria-label="Reward target"
            className="w-fit"
            tabs={[{ value: "all", label: "All users" }, { value: "selected", label: "Specific users" }]}
            value={target}
            onChange={setTarget}
          />
          {target === "selected" && (
            <UserPicker selected={selected} onAdd={addUser} onRemove={removeUser} searchUsers={searchUsers} />
          )}
        </div>

        {formError && !confirmOpen && <ErrorNote className="mt-3">{formError}</ErrorNote>}

        {result && (
          <div className="mt-4 rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-3 py-2.5 text-sm text-emerald-200">
            Rewarded <strong>{result.granted}</strong> user{result.granted === 1 ? "" : "s"} with {tierLabel(tier)}
            {result.skipped != null && result.skipped > 0 && (
              <> · <span className="text-emerald-300/80">{result.skipped} skipped (already on an equal or higher plan)</span></>
            )}
            {result.granted === 0 && target === "all" && <> · <span className="text-emerald-300/80">everyone is already on {tierLabel(tier)} or higher</span></>}
          </div>
        )}

        <div className="mt-4">
          <Button size="sm" icon={GiftIcon} disabled={!canSubmit} onClick={openConfirm}>Issue reward</Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-white">Recent rewards</h2>
        {error && <ErrorNote className="mb-3">{error}</ErrorNote>}
        <DataTable columns={columns} rows={batches} rowKey={(b) => b.batch_id} loading={loading} emptyTitle="No rewards issued yet." dense />
      </section>

      <Modal
        open={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        title="Issue this reward?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)} disabled={submitting}>Cancel</Button>
            <Button size="sm" onClick={handleIssue} loading={submitting} disabled={target === "all" && estimating}>Issue reward</Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-text">
          <p>
            Grant <strong className="text-white">{tierLabel(tier)}</strong> for <strong className="text-white">{durationLabel(parsedDays)}</strong>
            {target === "all" ? " to every eligible user" : ` to ${selected.length} selected user${selected.length === 1 ? "" : "s"}`}.
          </p>
          {target === "all" && (
            <p className="text-text-muted">
              {estimating ? "Estimating…" : estimate ? (
                <><strong className="text-white">~{estimate.eligible}</strong> of {estimate.total} active users will be upgraded and notified. Users already on {tierLabel(tier)} or higher are skipped.</>
              ) : null}
            </p>
          )}
          {message.trim() && (
            <p className="rounded-lg border border-border/50 bg-bg px-3 py-2 text-text-muted">“{message.trim()}”</p>
          )}
          {formError && <ErrorNote inline>{formError}</ErrorNote>}
        </div>
      </Modal>
    </div>
  );
}

export default TierRewardsPage;
