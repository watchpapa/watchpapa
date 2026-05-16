// Used by:
// - Frontend/src/App.jsx (route /admin/analytics)
import { useEffect, useState } from "react";
import { useAnalytics } from "../../features/admin/hooks/useAnalytics.js";
import { adminFetch } from "../../features/admin/adminFetch.js";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-[#1e244a] bg-[#12163a] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-[#4a4a8a]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value ?? "—"}</p>
      {sub && <p className="mt-0.5 text-xs text-[#4a4a8a]">{sub}</p>}
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <div className="rounded-2xl border border-[#1e244a] bg-[#0e1128] p-5">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#4a4a8a]">{title}</p>
      {sub && <p className="mb-4 text-[11px] text-[#4a4a8a]">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </div>
  );
}

function Bar({ label, value, max, color = "bg-sky-500", labelWidth = "w-20" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`${labelWidth} shrink-0 text-right text-xs text-[#8080a8] truncate`}>{label}</span>
      <div className="flex-1 h-2 overflow-hidden rounded-full bg-[#1a1f3a]">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-[#6868b8]">{value.toLocaleString()}</span>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border border-[#1e244a] bg-[#0e1128] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1e244a] px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#4a4a8a]">{title}</p>
          <button
            onClick={onClose}
            className="text-[#4a4a8a] hover:text-white transition text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function HeatCell({ value, max, label }) {
  const pct = max > 0 ? value / max : 0;
  const opacity = pct < 0.1 ? 0.1 : pct;
  return (
    <div className="flex flex-col items-center gap-0.5" title={`${label}: ${value}`}>
      <div
        className="w-7 h-7 rounded-md"
        style={{ background: `rgba(96, 165, 250, ${opacity})` }}
      />
      <span className="text-[9px] text-[#4a4a8a]">{label}</span>
    </div>
  );
}

function ExclusionsManager({ exclusions, onAdd, onRemove }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null); // { id, email, username }
  const [note, setNote] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const excludedIds = new Set((exclusions ?? []).map((e) => e.profile_id));

  async function handleSearch(e) {
    const q = e.target.value;
    setQuery(q);
    setSelected(null);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await adminFetch(`/api/admin/users/search?email=${encodeURIComponent(q.trim())}`);
      setResults(data.users ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function pickUser(user) {
    setSelected(user);
    setQuery(`${user.username ?? ""} — ${user.email}`);
    setResults([]);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      await onAdd(selected.id, note.trim());
      setQuery("");
      setSelected(null);
      setNote("");
      setResults([]);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Add form */}
      <form onSubmit={handleAdd} className="space-y-2">
        <p className="text-[11px] text-[#4a4a8a]">Search by email or username to exclude a user from page-view session stats.</p>
        <div className="relative">
          <input
            value={query}
            onChange={handleSearch}
            placeholder="Search email or username…"
            className="w-full rounded-lg border border-[#2a3570] bg-[#12163a] px-3 py-1.5 text-xs text-white placeholder-[#4a4a8a] focus:outline-none focus:border-[#6868b8]"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#2a3570] bg-[#0e1128] shadow-xl">
              {results.slice(0, 6).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => pickUser(u)}
                  disabled={excludedIds.has(u.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[#1a1f3a] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="font-medium text-white">{u.username ?? "—"}</span>
                  <span className="text-[#6868b8]">{u.email}</span>
                  {excludedIds.has(u.id) && <span className="ml-auto text-[#4a4a8a]">already excluded</span>}
                </button>
              ))}
            </div>
          )}
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#4a4a8a]">searching…</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason / note (optional)"
            className="flex-1 rounded-lg border border-[#2a3570] bg-[#12163a] px-3 py-1.5 text-xs text-white placeholder-[#4a4a8a] focus:outline-none focus:border-[#6868b8]"
          />
          <button
            type="submit"
            disabled={busy || !selected}
            className="rounded-lg border border-[#2a3570] bg-[#12163a] px-3 py-1.5 text-xs text-[#8080a8] transition hover:border-[#6868b8] hover:text-white disabled:opacity-40"
          >
            Exclude
          </button>
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
      </form>

      {/* Current exclusions list */}
      {exclusions && exclusions.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#4a4a8a]">
            Currently excluded ({exclusions.length})
          </p>
          <div className="overflow-x-auto rounded-xl border border-[#1e244a]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e244a] text-left text-[#4a4a8a]">
                  <th className="px-3 py-2 font-medium">Username</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Excluded</th>
                  <th className="px-3 py-2 font-medium">By</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e244a]">
                {exclusions.map((ex) => (
                  <tr key={ex.profile_id} className="hover:bg-[#0c1022]">
                    <td className="px-3 py-2 font-medium text-white">{ex.username ?? "—"}</td>
                    <td className="px-3 py-2 text-[#6868b8]">{ex.email ?? "—"}</td>
                    <td className="px-3 py-2 text-[#6868b8] whitespace-nowrap">
                      {new Date(ex.excluded_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-[#6868b8]">{ex.excluded_by_username ?? "—"}</td>
                    <td className="px-3 py-2 text-[#6868b8]">{ex.note ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => onRemove(ex.profile_id)}
                        className="text-red-400 hover:text-red-300 transition text-[11px]"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[#4a4a8a]">No exclusions yet.</p>
      )}
    </div>
  );
}

function TopContentRow({ item, rank, max }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-5 shrink-0 text-right text-xs text-[#4a4a8a]">{rank}</span>
      <span
        className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
        style={{ background: "rgba(10,12,35,0.82)", color: item.content_type === "movie" ? "#e8c04a" : "#7eb8f7" }}
      >
        {item.content_type}
      </span>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 overflow-hidden rounded-full bg-[#1a1f3a]">
          <div
            className="h-full rounded-full bg-sky-500"
            style={{ width: `${Math.round((item.clicks_7d / max) * 100)}%` }}
          />
        </div>
      </div>
      <span className="w-20 shrink-0 truncate text-right text-xs text-[#8080a8]">{item.title ?? "—"}</span>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[#6868b8]">{item.clicks_7d}</span>
    </div>
  );
}

function AnalyticsPage() {
  const { data, loading, error, refresh, addExclusion, removeExclusion } = useAnalytics();
  const [showAllContent, setShowAllContent] = useState(false);

  const {
    dauWauMau,
    heatmapDow,
    heatmapHour,
    pagesPerSession,
    topContent,
    clickByType,
    clickBySource,
    genreClicks,
    followByGenre,
    followByType,
    newUserActivation,
    unfollowRate,
    exclusions,
  } = data;

  const maxDow   = heatmapDow  ? Math.max(...heatmapDow.map((d) => d.unique_users), 1)  : 1;
  const maxHour  = heatmapHour ? Math.max(...heatmapHour.map((h) => h.unique_users), 1) : 1;
  const maxContent  = topContent   ? Math.max(...topContent.map((c) => c.clicks_7d), 1)    : 1;
  const maxGenreClick = genreClicks ? Math.max(...genreClicks.map((g) => g.click_count), 1)  : 1;
  const maxGenreFollow = followByGenre ? Math.max(...followByGenre.map((g) => g.follower_count), 1) : 1;

  const typeMap = Object.fromEntries((clickByType ?? []).map((r) => [r.content_type, r.total_clicks]));
  const totalTypeClicks = (typeMap.movie ?? 0) + (typeMap.show ?? 0);

  const sourceMap = Object.fromEntries((clickBySource ?? []).map((r) => [r.source, r.total_clicks]));
  const totalSourceClicks = Object.values(sourceMap).reduce((a, b) => a + b, 0);

  const followTypeMap = Object.fromEntries((followByType ?? []).map((r) => [r.content_type, r.follow_count]));
  const totalFollows = (followTypeMap.movie ?? 0) + (followTypeMap.show ?? 0);

  // Group unfollow-rate by week for a summary table (last 4 weeks).
  const unfollowByWeek = {};
  for (const r of unfollowRate ?? []) {
    const k = r.week_start;
    if (!unfollowByWeek[k]) unfollowByWeek[k] = { follows: 0, unfollows: 0 };
    if (r.event_type === "follow") unfollowByWeek[k].follows += r.event_count;
    else unfollowByWeek[k].unfollows += r.event_count;
  }
  const unfollowWeeks = Object.entries(unfollowByWeek)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Analytics</h1>
          <p className="mt-0.5 text-xs text-[#6868b8]">User activity and content engagement metrics</p>
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
        <div className="rounded-xl border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && !dauWauMau ? (
        <p className="text-sm text-[#6868b8]">Loading…</p>
      ) : (
        <>
          {/* ── Active users ───────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="DAU (24 h)" value={dauWauMau?.dau?.toLocaleString()} />
            <StatCard label="WAU (7 days)" value={dauWauMau?.wau?.toLocaleString()} />
            <StatCard label="MAU (30 days)" value={dauWauMau?.mau?.toLocaleString()} />
          </div>

          {/* ── Session quality ─────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Avg pages / session"
              value={pagesPerSession ? pagesPerSession.avg_pages?.toFixed(1) : "—"}
              sub={pagesPerSession ? `${pagesPerSession.total_sessions?.toLocaleString()} sessions · 30 days` : null}
            />
            <StatCard
              label="New user activation"
              value={newUserActivation ? `${newUserActivation.activation_pct}%` : "—"}
              sub={newUserActivation ? `${newUserActivation.activated} of ${newUserActivation.new_users} new users followed within 7 days` : null}
            />
            <StatCard
              label="Total follows"
              value={totalFollows.toLocaleString()}
              sub="all time"
            />
            <StatCard
              label="Movie / Show split"
              value={totalFollows > 0 ? `${Math.round((followTypeMap.movie ?? 0) / totalFollows * 100)}% / ${Math.round((followTypeMap.show ?? 0) / totalFollows * 100)}%` : "—"}
              sub="movies / shows"
            />
          </div>

          {/* ── Day-of-week heatmap ─────────────────────────────── */}
          <Section title="Day-of-week activity" sub="Unique active users per day of week · last 30 days">
            <div className="flex gap-2 flex-wrap">
              {(heatmapDow ?? []).map((d) => (
                <HeatCell key={d.dow} value={d.unique_users} max={maxDow} label={DOW_LABELS[d.dow]} />
              ))}
            </div>
          </Section>

          {/* ── Hour-of-day heatmap ─────────────────────────────── */}
          <Section title="Hour-of-day activity (UTC)" sub="Unique active users per clock hour · last 30 days">
            <div className="flex gap-1.5 flex-wrap">
              {(heatmapHour ?? []).map((h) => (
                <HeatCell key={h.hour_of_day} value={h.unique_users} max={maxHour} label={String(h.hour_of_day).padStart(2, "0")} />
              ))}
            </div>
          </Section>

          {/* ── Content clicks ──────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Section title="Click by type" sub="Last 30 days">
              <div className="space-y-3">
                <Bar label="Movies" value={typeMap.movie ?? 0} max={totalTypeClicks || 1} color="bg-amber-500" labelWidth="w-14" />
                <Bar label="Shows"  value={typeMap.show  ?? 0} max={totalTypeClicks || 1} color="bg-sky-500"   labelWidth="w-14" />
              </div>
            </Section>

            <Section title="Click by source" sub="Last 30 days">
              <div className="space-y-3">
                {["browse", "search", "calendar", "detail"].map((src) => (
                  <Bar
                    key={src}
                    label={src.charAt(0).toUpperCase() + src.slice(1)}
                    value={sourceMap[src] ?? 0}
                    max={totalSourceClicks || 1}
                    color={src === "search" ? "bg-violet-500" : src === "calendar" ? "bg-emerald-500" : src === "detail" ? "bg-rose-500" : "bg-sky-500"}
                    labelWidth="w-16"
                  />
                ))}
              </div>
            </Section>
          </div>

          {/* ── Top content (7-day window) ──────────────────────── */}
          <Section title="Top clicked content" sub="7-day sliding window · used for popularity algorithm">
            {topContent && topContent.length > 0 ? (
              <>
                <div className="space-y-2">
                  {topContent.slice(0, 10).map((item, i) => (
                    <TopContentRow key={`${item.content_type}-${item.content_id}`} item={item} rank={i + 1} max={maxContent} />
                  ))}
                </div>
                {topContent.length > 10 && (
                  <button
                    onClick={() => setShowAllContent(true)}
                    className="mt-4 text-xs text-[#6868b8] hover:text-white transition"
                  >
                    See all {topContent.length} →
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-[#4a4a8a]">No click data yet.</p>
            )}
          </Section>

          {showAllContent && topContent && (
            <Modal title="Top clicked content — 7-day window" onClose={() => setShowAllContent(false)}>
              <div className="space-y-2">
                {topContent.map((item, i) => (
                  <TopContentRow key={`${item.content_type}-${item.content_id}`} item={item} rank={i + 1} max={maxContent} />
                ))}
              </div>
            </Modal>
          )}

          {/* ── Genre clicks + follows ──────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Section title="Genre clicks" sub="Last 30 days">
              <div className="space-y-2">
                {(genreClicks ?? []).slice(0, 12).map((g) => (
                  <Bar
                    key={`${g.genre_id}-${g.content_type}`}
                    label={g.genre_name}
                    value={g.click_count}
                    max={maxGenreClick}
                    color={g.content_type === "movie" ? "bg-amber-500" : "bg-sky-500"}
                    labelWidth="w-24"
                  />
                ))}
                {(!genreClicks || genreClicks.length === 0) && <p className="text-xs text-[#4a4a8a]">No genre click data yet.</p>}
              </div>
            </Section>

            <Section title="Genre follows" sub="All time · derived from follow tables">
              <div className="space-y-2">
                {(followByGenre ?? []).slice(0, 12).map((g) => (
                  <Bar
                    key={`${g.genre_name}-${g.content_type}`}
                    label={g.genre_name}
                    value={g.follower_count}
                    max={maxGenreFollow}
                    color={g.content_type === "movie" ? "bg-amber-500" : "bg-sky-500"}
                    labelWidth="w-24"
                  />
                ))}
                {(!followByGenre || followByGenre.length === 0) && <p className="text-xs text-[#4a4a8a]">No follow data yet.</p>}
              </div>
            </Section>
          </div>

          {/* ── Unfollow rate ───────────────────────────────────── */}
          <Section title="Follow / Unfollow trend" sub="Last 12 weeks · from audit log">
            {unfollowWeeks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[#4a4a8a]">
                      <th className="pb-2 pr-4 font-medium">Week</th>
                      <th className="pb-2 pr-4 font-medium text-right">Follows</th>
                      <th className="pb-2 pr-4 font-medium text-right">Unfollows</th>
                      <th className="pb-2 font-medium text-right">Unfollow %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e244a]">
                    {unfollowWeeks.map(([week, { follows, unfollows }]) => {
                      const total = follows + unfollows;
                      const pct = total > 0 ? ((unfollows / total) * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={week}>
                          <td className="py-1.5 pr-4 text-[#8080a8]">{week}</td>
                          <td className="py-1.5 pr-4 text-right text-emerald-400">{follows.toLocaleString()}</td>
                          <td className="py-1.5 pr-4 text-right text-red-400">{unfollows.toLocaleString()}</td>
                          <td className="py-1.5 text-right text-[#6868b8]">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[#4a4a8a]">No follow/unfollow events in the last 12 weeks.</p>
            )}
          </Section>

          {/* ── Tracking exclusions ─────────────────────────────── */}
          <Section title="Tracking exclusions" sub="Users excluded from all analytics tracking. Search by email to add anyone, including admins.">
            <ExclusionsManager
              exclusions={exclusions}
              onAdd={addExclusion}
              onRemove={removeExclusion}
            />
          </Section>
        </>
      )}
    </div>
  );
}

export default AnalyticsPage;
