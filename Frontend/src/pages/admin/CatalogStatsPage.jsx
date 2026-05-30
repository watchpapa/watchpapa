import { useEffect } from "react";
import { useCatalogStats } from "../../features/admin/hooks/useCatalogStats.js";

function n(v) {
  return (v ?? 0).toLocaleString();
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-xl border bg-[#12163a] px-4 py-3 ${accent ? "border-indigo-700/40" : "border-[#1e244a]"}`}>
      <p className="text-[10px] uppercase tracking-wider text-[#4a4a8a]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#4a4a8a]">{sub}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#4a4a8a]">{title}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

function CatalogStatsPage() {
  const { stats, loading, error, refresh } = useCatalogStats();

  useEffect(() => { refresh(); }, [refresh]);

  const c = stats?.content;
  const cr = stats?.credits;
  const a = stats?.activity;

  const totalContent = c
    ? c.movies.active + c.shows + c.seasons + c.episodes + c.people.active
    : 0;

  const totalCredits = cr ? cr.movie + cr.show + cr.episode : 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Catalog Stats</h1>
          <p className="mt-0.5 text-xs text-[#6868b8]">Row counts across all content and activity tables</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-[#2a3570] bg-[#12163a] px-3 py-1.5 text-xs text-[#8080a8] transition hover:border-[#6868b8] hover:text-white disabled:opacity-40"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && !stats && (
        <p className="text-sm text-[#6868b8]">Loading…</p>
      )}

      {stats && (
        <div className="space-y-8">

          {/* Summary row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Total catalog rows" value={n(totalContent)} accent />
            <StatCard label="Total credit rows" value={n(totalCredits)} accent />
            <StatCard label="Total ratings" value={n(a.ratings)} accent />
          </div>

          <Section title="Content">
            <StatCard
              label="Movies"
              value={n(c.movies.active)}
              sub={c.movies.deleted > 0 ? `+ ${n(c.movies.deleted)} soft-deleted` : undefined}
            />
            <StatCard label="TV Shows" value={n(c.shows)} />
            <StatCard label="Seasons" value={n(c.seasons)} />
            <StatCard label="Episodes" value={n(c.episodes)} />
            <StatCard
              label="People"
              value={n(c.people.active)}
              sub={c.people.deleted > 0 ? `+ ${n(c.people.deleted)} soft-deleted` : undefined}
            />
            <StatCard label="Person AKAs" value={n(cr.personAkas)} />
            <StatCard label="Genres" value={n(c.genres)} />
          </Section>

          <Section title="Credits">
            <StatCard label="Movie credits" value={n(cr.movie)} />
            <StatCard label="Show credits" value={n(cr.show)} />
            <StatCard label="Episode credits" value={n(cr.episode)} />
          </Section>

          <Section title="User Activity">
            <StatCard label="Ratings" value={n(a.ratings)} />
            <StatCard label="Watchlists" value={n(a.watchlists)} />
            <StatCard label="Watchlist items" value={n(a.watchlistItems)} />
            <StatCard
              label="Movie follows"
              value={n(a.followedMovies)}
            />
            <StatCard
              label="Show follows"
              value={n(a.followedShows)}
            />
            <StatCard
              label="Total follows"
              value={n(a.followedMovies + a.followedShows)}
            />
            <StatCard label="Favourites" value={n(a.favourites)} />
          </Section>

        </div>
      )}
    </div>
  );
}

export default CatalogStatsPage;
