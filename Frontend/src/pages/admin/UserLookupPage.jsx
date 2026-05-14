import { useState } from "react";
import { useUserLookup } from "../../features/admin/hooks/useUserLookup.js";

const TIERS = ["premium", "pro", "pro_plus"];
const TIER_LABEL = { premium: "Premium", pro: "Pro", pro_plus: "Pro+" };
const TIER_COLORS = {
  free:     "bg-green-900/40 text-green-400 border-green-700/50",
  premium:  "bg-amber-900/40 text-amber-400 border-amber-700/50",
  pro:      "bg-sky-900/40 text-sky-400 border-sky-700/50",
  pro_plus: "bg-violet-900/40 text-violet-400 border-violet-700/50",
  god:      "bg-rose-900/40 text-rose-400 border-rose-800/40",
};

function TierBadge({ tier }) {
  const label = TIER_LABEL[tier] ?? (tier ? tier.replace("_", "+") : "Free");
  const colors = TIER_COLORS[tier] ?? TIER_COLORS.free;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors}`}>
      {label}
    </span>
  );
}

function GrantForm({ userId, onGrant, state }) {
  const [tier, setTier] = useState("premium");
  const [days, setDays] = useState("");

  const s = state ?? {};

  function handleSubmit(e) {
    e.preventDefault();
    onGrant(userId, tier, days === "" ? null : Number(days));
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2 border-t border-[#1e244a] pt-3">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-[#4a4a8a]">Tier</span>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1 text-sm text-white outline-none focus:border-[#6868b8]"
        >
          {TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-[#4a4a8a]">Days (blank = lifetime)</span>
        <input
          type="number"
          min="1"
          placeholder="lifetime"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-32 rounded-lg border border-[#2a3570] bg-[#12163a] px-2 py-1 text-sm text-white outline-none placeholder-[#4a4a8a] focus:border-[#6868b8]"
        />
      </label>
      <button
        type="submit"
        disabled={s.loading}
        className="self-end rounded-lg bg-indigo-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
      >
        {s.loading ? "Granting…" : "Grant"}
      </button>
      {s.success && <span className="self-end text-xs text-emerald-400">Granted</span>}
      {s.error   && <span className="self-end text-xs text-red-400">{s.error}</span>}
    </form>
  );
}

function UserCard({ user, onGrant, grantState }) {
  const [open, setOpen] = useState(false);
  const effectiveTier = user.tier ?? "free";
  const isExpired = user.expires_at && new Date(user.expires_at) < new Date();

  return (
    <div className="rounded-xl border border-[#1e244a] bg-[#0e1128] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{user.email}</p>
          <p className="text-xs text-[#6868b8]">@{user.username ?? "—"}</p>
          <p className="mt-0.5 text-[10px] text-[#4a4a8a]">ID: {user.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <TierBadge tier={effectiveTier} />
          {user.is_early_adopter && (
            <span className="rounded-full border border-amber-700/50 bg-amber-900/30 px-2 py-0.5 text-xs text-amber-400">
              Early Adopter
            </span>
          )}
          {isExpired && (
            <span className="rounded-full border border-[#2a3570] bg-[#1a1f3a] px-2 py-0.5 text-xs text-[#5a5a78]">
              Expired
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#6868b8]">
        {user.source && <span>Source: <span className="text-[#8080a8]">{user.source}</span></span>}
        {user.expires_at && (
          <span>
            {isExpired ? "Expired" : "Expires"}:{" "}
            <span className="text-[#8080a8]">{new Date(user.expires_at).toLocaleDateString()}</span>
          </span>
        )}
        <span>Joined: <span className="text-[#8080a8]">{new Date(user.created_at).toLocaleDateString()}</span></span>
        {user.role === 4 && <span className="text-rose-400 font-medium">Admin</span>}
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition"
      >
        {open ? "Hide grant form ▲" : "Grant tier ▼"}
      </button>

      {open && (
        <GrantForm userId={user.id} onGrant={onGrant} state={grantState[user.id]} />
      )}
    </div>
  );
}

function UserLookupPage() {
  const { users, loading, error, search, grantTier, grantState } = useUserLookup();
  const [query, setQuery] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (query.trim().length >= 2) search(query.trim());
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">User Lookup</h1>
        <p className="mt-0.5 text-xs text-[#6868b8]">Search by email or username · grant tiers manually</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-5 flex gap-2">
        <input
          type="text"
          placeholder="Email or username…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-[#2a3570] bg-[#12163a] px-3 py-2 text-sm text-white outline-none placeholder-[#4a4a8a] focus:border-[#6868b8]"
        />
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && users.length === 0 && query && (
        <p className="text-sm text-[#5a5a78]">No users found.</p>
      )}

      <div className="space-y-3">
        {users.map((u) => (
          <UserCard key={u.id} user={u} onGrant={grantTier} grantState={grantState} />
        ))}
      </div>
    </div>
  );
}

export default UserLookupPage;
