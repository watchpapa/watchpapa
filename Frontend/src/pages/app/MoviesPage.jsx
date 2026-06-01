import { useState } from "react";
import AppLayout from "../../layouts/AppLayout.jsx";
import MediaRow from "../../components/home/MediaRow.jsx";
import SearchBar from "../../components/home/SearchBar.jsx";
import { useMoviesPageData } from "../../features/movies/hooks/useMoviesPageData.js";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";

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

function MoviesPage({ session, showAdult }) {
  const [search, setSearch] = useState("");
  const {
    popular,
    comingSoonItems,
    byGenre,
    isLoading,
    error,
    followLimitError,
    clearFollowLimitError,
    hasMorePopular,
    loadMorePopular,
    loadingMorePopular,
  } = useMoviesPageData(session, showAdult);

  return (
    <AppLayout session={session}>
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      <div className="mx-auto max-w-[1600px] space-y-8">
        <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} />
        {error && (
          <p className="text-center text-sm text-red-400">Failed to load movies: {error}</p>
        )}

        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            <MediaRow
              title="Popular"
              items={popular}
              session={session}
              hasMore={hasMorePopular}
              onLoadMore={loadMorePopular}
              isLoadingMore={loadingMorePopular}
            />
            {comingSoonItems.length > 0 && (
              <MediaRow
                title="Coming Soon"
                items={comingSoonItems}
                session={session}
                hasMore={false}
                onLoadMore={null}
                isLoadingMore={false}
              />
            )}
            {byGenre.map(({ genreId, genreName, items, hasMore, onLoadMore, isLoadingMore }) => (
              <MediaRow
                key={genreId}
                title={genreName}
                items={items}
                session={session}
                hasMore={hasMore}
                onLoadMore={onLoadMore}
                isLoadingMore={isLoadingMore}
              />
            ))}
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default MoviesPage;
