import { useState } from "react";
import AppLayout from "../../layouts/AppLayout.jsx";
import MediaRow from "../../components/home/MediaRow.jsx";
import SearchBar from "../../components/home/SearchBar.jsx";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import { SkeletonPosterRow } from "../../components/ui/Skeleton.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useMediaBrowse } from "../../features/content/hooks/useMediaBrowse.js";

const COPY = {
  movie: {
    title: "Movies",
    subtitle: "Popular right now, coming soon, and every genre — straight from TMDB.",
    path: "/movies",
    description: "Browse popular and upcoming movies by genre on watchpapa.",
  },
  show: {
    title: "Shows",
    subtitle: "What's popular, what's airing next, and every genre.",
    path: "/shows",
    description: "Browse popular and upcoming TV shows by genre on watchpapa.",
  },
};

// /movies and /shows were two 95%-identical files; this is the one page,
// parameterised by `kind`.
function MediaBrowsePage({ kind, session, showAdult }) {
  const copy = COPY[kind];
  const [search, setSearch] = useState("");
  const {
    popular, comingSoonItems, byGenre, myServicesItems, hasMoreMyServices, loadMoreMyServices, loadingMyServices,
    isLoading, error, followLimitError, clearFollowLimitError, hasMorePopular, loadMorePopular, loadingMorePopular,
  } = useMediaBrowse(kind, session, showAdult);

  return (
    <AppLayout session={session}>
      <PageHead title={copy.title} description={copy.description} path={copy.path} />
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      <PageContainer width="wide" className="space-y-8">
        <PageHeader title={copy.title} subtitle={copy.subtitle}>
          <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} maxWidthClass="max-w-[640px]" />
        </PageHeader>

        {error && <ErrorNote>Failed to load {copy.title.toLowerCase()}: {error}</ErrorNote>}

        {isLoading ? (
          <>
            <SkeletonPosterRow />
            <SkeletonPosterRow />
            <SkeletonPosterRow />
          </>
        ) : (
          <>
            <MediaRow title="Popular" items={popular} session={session} hasMore={hasMorePopular} onLoadMore={loadMorePopular} isLoadingMore={loadingMorePopular} />
            {comingSoonItems.length > 0 && <MediaRow title="Coming Soon" items={comingSoonItems} session={session} />}
            {myServicesItems.length > 0 && (
              <MediaRow title="Available on your services" items={myServicesItems} session={session} hasMore={hasMoreMyServices} onLoadMore={loadMoreMyServices} isLoadingMore={loadingMyServices} />
            )}
            {byGenre.map(({ genreId, genreName, items, hasMore, onLoadMore, isLoadingMore }) => (
              <MediaRow key={genreId} title={genreName} items={items} session={session} hasMore={hasMore} onLoadMore={onLoadMore} isLoadingMore={isLoadingMore} />
            ))}
          </>
        )}
      </PageContainer>
    </AppLayout>
  );
}

export default MediaBrowsePage;
