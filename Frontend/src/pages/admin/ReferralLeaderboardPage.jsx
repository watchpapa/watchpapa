import { useReferralLeaderboard } from "../../features/admin/hooks/useReferralLeaderboard.js";

function SummaryCard({ label, value, color }) {
  return (
    <div className="rounded-xl border border-[#1e244a] bg-[#12163a] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-[#4a4a8a]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function ReferralLeaderboardPage() {
  const { data, loading, error, refresh } = useReferralLeaderboard();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Referral Leaderboard</h1>
          <p className="mt-0.5 text-xs text-[#6868b8]">Top referrers by rewarded referrals</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-3 py-1.5 text-xs text-[#8080a8] transition hover:border-[#6868b8] hover:text-white disabled:opacity-40"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && !data ? (
        <p className="text-sm text-[#6868b8]">Loading…</p>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Total"    value={data.summary.total.toLocaleString()} />
            <SummaryCard label="Rewarded" value={data.summary.rewarded.toLocaleString()} color="text-emerald-400" />
            <SummaryCard label="Pending"  value={data.summary.pending.toLocaleString()}  color="text-amber-400" />
            <SummaryCard label="Expired"  value={data.summary.expired.toLocaleString()}  color="text-[#5a5a78]" />
          </div>

          <div className="rounded-2xl border border-[#1e244a] bg-[#0e1128] overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="border-b border-[#1e244a]">
                  {["#", "User", "Total", "Rewarded", "Pending", "Expired"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4a4a8a]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#4a4a8a]">
                      No referrals yet.
                    </td>
                  </tr>
                ) : (
                  data.leaderboard.map((row, i) => (
                    <tr key={row.referrer_id} className="border-b border-[#2a3570]/50 last:border-0 hover:bg-[#111530]">
                      <td className="px-4 py-3 text-[#4a4a8a] tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="text-white">{row.email ?? "—"}</p>
                        {row.username && <p className="text-xs text-[#6868b8]">@{row.username}</p>}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#8080a8]">{row.total}</td>
                      <td className="px-4 py-3 tabular-nums font-medium text-emerald-400">{row.rewarded}</td>
                      <td className="px-4 py-3 tabular-nums text-amber-400">{row.pending}</td>
                      <td className="px-4 py-3 tabular-nums text-[#5a5a78]">{row.expired}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ReferralLeaderboardPage;
