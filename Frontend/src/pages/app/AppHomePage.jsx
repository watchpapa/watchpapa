import { useState } from "react";
import AppLayout from "../../layouts/AppLayout.jsx";
import HeroBanner from "../../components/home/HeroBanner.jsx";
import ContentHero from "../../components/home/ContentHero.jsx";
import SearchBar from "../../components/home/SearchBar.jsx";
import MediaRow from "../../components/home/MediaRow.jsx";
import { useHomeData } from "../../features/home/hooks/useHomeData.js";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

function SkeletonRow() {
  return (
    <section className="flex flex-col items-center">
      <div className="mb-3 h-6 w-32 animate-pulse rounded bg-[#1e2240]" />
      <div className="flex w-full justify-start gap-3 overflow-x-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-[100px] flex-shrink-0 sm:w-[132px] lg:w-[150px]">
            <div className="aspect-[2/3] animate-pulse rounded-2xl bg-[#1e2240]" />
            <div className="mt-2 h-3 animate-pulse rounded bg-[#1e2240]" />
            <div className="mt-1.5 mx-auto h-5 w-16 animate-pulse rounded-full bg-[#1e2240]" />
          </div>
        ))}
      </div>
    </section>
  );
}

function AppHomePage({ session, showAdult }) {
  const [search, setSearch] = useState("");
  const {
    popular,
    comingSoonItems,
    movieItems,
    showItems,
    myServicesItems,
    isLoading,
    error,
    followLimitError,
    clearFollowLimitError,
    hasMorePopular,
    hasMoreMovies,
    hasMoreShows,
    hasMoreMyServices,
    loadMorePopular,
    loadMoreMovies,
    loadMoreShows,
    loadMoreMyServices,
    loadingMorePopular,
    loadingMoreMovies,
    loadingMoreShows,
    loadingMoreMyServices,
  } = useHomeData(session, showAdult);

  const sections = [
    {
      title: "Popular",
      items: popular,
      hasMore: hasMorePopular,
      onLoadMore: loadMorePopular,
      isLoadingMore: loadingMorePopular,
    },
    {
      title: "Popular on my streamings",
      items: myServicesItems,
      hasMore: hasMoreMyServices,
      onLoadMore: loadMoreMyServices,
      isLoadingMore: loadingMoreMyServices,
    },
    {
      title: "Coming Soon",
      items: comingSoonItems,
      hasMore: false,
      onLoadMore: null,
      isLoadingMore: false,
    },
    {
      title: "Movies",
      items: movieItems,
      hasMore: hasMoreMovies,
      onLoadMore: loadMoreMovies,
      isLoadingMore: loadingMoreMovies,
    },
    {
      title: "Shows",
      items: showItems,
      hasMore: hasMoreShows,
      onLoadMore: loadMoreShows,
      isLoadingMore: loadingMoreShows,
    },
  ];

  return (
    <AppLayout session={session}>
      <PageHead
        title="Discover Films, Shows & People"
        description="Browse popular movies and TV shows, explore people and cast, check upcoming releases, and track what to watch next."
        path="/"
      />
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      {!isLoading && popular.length > 0 ? (
        <ContentHero items={popular} isAuthenticated={!!session} />
      ) : (
        <HeroBanner />
      )}
      <div className="mx-auto max-w-[1600px] space-y-8">
        <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} />

        {error && (
          <p className="text-center text-sm text-red-400">
            Failed to load content: {error}
          </p>
        )}

        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          sections
            .filter(({ items }) => items.length > 0)
            .map(({ title, items, hasMore, onLoadMore, isLoadingMore }, index) => (
              <div
                key={title}
                style={{
                  animation: "fadeInUp 0.35s ease-out both",
                  animationDelay: `${index * 0.08}s`,
                }}
              >
                <MediaRow
                  title={title}
                  items={items}
                  session={session}
                  hasMore={hasMore}
                  onLoadMore={onLoadMore}
                  isLoadingMore={isLoadingMore}
                />
              </div>
            ))
        )}
      </div>
    </AppLayout>
  );
}

export default AppHomePage;
