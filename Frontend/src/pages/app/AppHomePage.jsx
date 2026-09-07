import { useState } from "react";
import { useNavigationType } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import HeroBanner from "../../components/home/HeroBanner.jsx";
import ContentHero from "../../components/home/ContentHero.jsx";
import SearchBar from "../../components/home/SearchBar.jsx";
import MediaRow from "../../components/home/MediaRow.jsx";
import { useHomeData } from "../../features/home/hooks/useHomeData.js";
import { usePreferences } from "../../features/preferences/PreferencesContext.jsx";
import { HOME_ROW_LABELS, effectiveHomeRowOrder } from "../../lib/homeRows.js";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import { SkeletonPosterRow } from "../../components/ui/Skeleton.jsx";

function AppHomePage({ session, showAdult }) {
  const [search, setSearch] = useState("");
  const { homeRowOrder, homeHiddenRows } = usePreferences();
  const d = useHomeData(session, showAdult);
  // On Back the rows are restored from cache — don't replay the entrance animation.
  const isBack = useNavigationType() === "POP";

  const sectionsByKey = {
    popular: { items: d.popular, hasMore: d.hasMorePopular, onLoadMore: d.loadMorePopular, isLoadingMore: d.loadingMorePopular },
    suggested: { items: d.suggestedItems, hasMore: d.hasMoreSuggested, onLoadMore: d.loadMoreSuggested, isLoadingMore: d.loadingMoreSuggested },
    popularOnServices: { items: d.myServicesItems, hasMore: d.hasMoreMyServices, onLoadMore: d.loadMoreMyServices, isLoadingMore: d.loadingMoreMyServices },
    suggestedOnServices: { items: d.suggestedOnServicesItems, hasMore: d.hasMoreSuggestedOnServices, onLoadMore: d.loadMoreSuggestedOnServices, isLoadingMore: d.loadingMoreSuggestedOnServices },
    comingSoon: { items: d.comingSoonItems, hasMore: false, onLoadMore: null, isLoadingMore: false },
    movies: { items: d.movieItems, hasMore: d.hasMoreMovies, onLoadMore: d.loadMoreMovies, isLoadingMore: d.loadingMoreMovies },
    shows: { items: d.showItems, hasMore: d.hasMoreShows, onLoadMore: d.loadMoreShows, isLoadingMore: d.loadingMoreShows },
  };

  const sections = effectiveHomeRowOrder(homeRowOrder)
    .filter((key) => !homeHiddenRows.includes(key))
    .map((key) => ({ key, title: HOME_ROW_LABELS[key], ...sectionsByKey[key] }));

  return (
    <AppLayout session={session}>
      <PageHead title="Discover Films, Shows & People" description="Browse popular movies and TV shows, explore people and cast, check upcoming releases, and track what to watch next." path="/" />
      {d.followLimitError && <UpgradePromptToast message={d.followLimitError} onDismiss={d.clearFollowLimitError} session={session} />}
      {!d.isLoading && d.popular.length > 0 ? <ContentHero items={d.popular} isAuthenticated={!!session} /> : <HeroBanner />}
      <PageContainer width="wide" className="space-y-8">
        <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} />
        {d.error && <ErrorNote>Failed to load content: {d.error}</ErrorNote>}
        {d.isLoading ? (
          <><SkeletonPosterRow /><SkeletonPosterRow /><SkeletonPosterRow /></>
        ) : (
          sections
            .filter(({ items }) => items.length > 0)
            .map(({ key, title, items, hasMore, onLoadMore, isLoadingMore }, index) => (
              <div
                key={key}
                className={isBack ? undefined : "animate-slide-up"}
                style={isBack ? undefined : { animationDelay: `${index * 0.06}s`, animationFillMode: "both" }}
              >
                <MediaRow rowKey={key} title={title} items={items} session={session} hasMore={hasMore} onLoadMore={onLoadMore} isLoadingMore={isLoadingMore} />
              </div>
            ))
        )}
      </PageContainer>
    </AppLayout>
  );
}

export default AppHomePage;
