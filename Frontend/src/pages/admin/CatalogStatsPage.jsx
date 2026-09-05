import { useEffect } from "react";
import { useCatalogStats } from "../../features/admin/hooks/useCatalogStats.js";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { StatCard, StatGrid } from "../../components/admin/StatCard.jsx";
import { RefreshIcon } from "../../components/icons/index.jsx";

const n = (v) => (v ?? 0).toLocaleString();

function CatalogStatsPage() {
  const { stats, loading, error, refresh } = useCatalogStats();
  useEffect(() => { refresh(); }, [refresh]);
  const a = stats?.activity;

  return (
    <div>
      <PageHeader size="sm" title="Catalog Stats" subtitle="User activity row counts (content is served live from TMDB)" actions={<Button variant="secondary" size="sm" icon={RefreshIcon} onClick={refresh} loading={loading}>Refresh</Button>} />
      {error && <ErrorNote className="mb-4" onRetry={refresh}>{error}</ErrorNote>}
      {loading && !stats && <StatGrid>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</StatGrid>}
      {stats && a && (
        <div className="space-y-8">
          <StatGrid className="sm:grid-cols-3 lg:grid-cols-3">
            <StatCard label="Profiles" value={n(a.profiles)} accent />
            <StatCard label="Total ratings" value={n(a.ratings)} accent />
            <StatCard label="Total follows" value={n(a.followedMovies + a.followedShows)} accent />
          </StatGrid>
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-text-faint">User activity</p>
            <StatGrid>
              <StatCard label="Ratings" value={n(a.ratings)} />
              <StatCard label="Watchlists" value={n(a.watchlists)} />
              <StatCard label="Watchlist items" value={n(a.watchlistItems)} />
              <StatCard label="Movie follows" value={n(a.followedMovies)} />
              <StatCard label="Show follows" value={n(a.followedShows)} />
              <StatCard label="Favourites" value={n(a.favourites)} />
            </StatGrid>
          </div>
        </div>
      )}
    </div>
  );
}

export default CatalogStatsPage;
