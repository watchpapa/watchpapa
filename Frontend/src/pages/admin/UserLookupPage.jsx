import { useState } from "react";
import { useUserLookup } from "../../features/admin/hooks/useUserLookup.js";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Select from "../../components/ui/Select.jsx";
import Badge from "../../components/ui/Badge.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { TIER_BADGE_VARIANTS, tierLabel } from "../../lib/tierMeta.js";
import { SearchIcon } from "../../components/icons/index.jsx";

const TIERS = ["free", "premium", "pro", "pro_plus", "god"];

function SetTierForm({ userId, onSet, state }) {
  const [tier, setTierVal] = useState("premium");
  const [days, setDays] = useState("");
  const s = state ?? {};
  const showDuration = tier !== "free" && tier !== "god";

  function handleSubmit(e) {
    e.preventDefault();
    onSet(userId, tier, showDuration && days !== "" ? Number(days) : null);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-faint">Tier</span>
        <Select size="sm" value={tier} onChange={setTierVal} options={TIERS.map((t) => ({ value: t, label: tierLabel(t) }))} className="w-full sm:w-36" />
      </label>
      {showDuration && (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-faint">Days (blank = lifetime)</span>
          <Input size="md" type="number" min="1" placeholder="lifetime" value={days} onChange={(e) => setDays(e.target.value)} className="h-9 sm:w-36" />
        </label>
      )}
      <Button type="submit" size="sm" loading={s.loading}>Set tier</Button>
      {s.success && <span className="text-xs text-emerald-400 sm:self-center">Updated</span>}
      {s.error && <span className="text-xs text-red-300 sm:self-center">{s.error}</span>}
    </form>
  );
}

function UserCard({ user, onSet, grantState }) {
  const [open, setOpen] = useState(false);
  const effectiveTier = user.tier ?? "free";
  const isExpired = user.expires_at && new Date(user.expires_at) < new Date();

  return (
    <div className="rounded-xl border border-border/50 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{user.email}</p>
          <p className="text-xs text-text-dim">@{user.username ?? "—"}</p>
          <p className="mt-0.5 break-all font-mono text-[10px] text-text-faint">{user.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={TIER_BADGE_VARIANTS[effectiveTier] ?? "neutral"}>{tierLabel(effectiveTier)}</Badge>
          {user.is_early_adopter && <Badge variant="gold">Early Adopter</Badge>}
          {isExpired && <Badge>Expired</Badge>}
          {user.role === 4 && <Badge variant="danger">Admin</Badge>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-dim">
        {user.source && <span>Source: <span className="text-text-muted">{user.source}</span></span>}
        {user.expires_at && <span>{isExpired ? "Expired" : "Expires"}: <span className="text-text-muted">{new Date(user.expires_at).toLocaleDateString()}</span></span>}
        <span>Joined: <span className="text-text-muted">{new Date(user.created_at).toLocaleDateString()}</span></span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" size="xs" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? "Hide tier form" : "Set tier"}</Button>
        <Button variant="ghost" size="xs" to={`/admin/audit-log?user_id=${user.id}`}>Audit trail</Button>
      </div>
      {open && <SetTierForm userId={user.id} onSet={onSet} state={grantState[user.id]} />}
    </div>
  );
}

function UserLookupPage() {
  const { users, loading, error, search, setTier, grantState } = useUserLookup();
  const [query, setQuery] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (query.trim().length >= 2) search(query.trim());
  }

  return (
    <div>
      <PageHeader size="sm" title="User Lookup" subtitle="Search by email or username · grant tiers manually" />
      <form onSubmit={handleSubmit} className="mb-5 flex gap-2">
        <Input size="md" placeholder="Email or username…" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1" aria-label="Search users" />
        <Button type="submit" size="md" icon={SearchIcon} loading={loading} disabled={query.trim().length < 2}>Search</Button>
      </form>
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      {!loading && users.length === 0 && query && <EmptyState compact title="No users found." />}
      <div className="space-y-3">
        {users.map((u) => <UserCard key={u.id} user={u} onSet={setTier} grantState={grantState} />)}
      </div>
    </div>
  );
}

export default UserLookupPage;
