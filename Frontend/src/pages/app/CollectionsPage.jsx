import { useState } from "react";
import AppLayout from "../../layouts/AppLayout.jsx";
import Input from "../../components/ui/Input.jsx";
import CollectionCard from "../../components/detail/CollectionCard.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import PosterGrid from "../../components/home/PosterGrid.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import LoadMoreButton from "../../components/ui/LoadMoreButton.jsx";
import { SkeletonPosterGrid } from "../../components/ui/Skeleton.jsx";
import { useCollectionSearch } from "../../features/collection/hooks/useCollectionSearch.js";
import { LayersIcon, SearchIcon } from "../../components/icons/index.jsx";

function CollectionsPage({ session }) {
  const [query, setQuery] = useState("");
  const { results, isLoading, isLoadingMore, error, hasMore, loadMore } = useCollectionSearch(query);
  const trimmed = query.trim();

  return (
    <AppLayout session={session}>
      <PageHead title="Collections" description="Search movie franchises and collections on watchpapa." path="/collections" />
      <PageContainer width="wide" className="space-y-6">
        <PageHeader title="Collections" subtitle="Search for a franchise (e.g. “Alien”, “James Bond”) to see every film in it.">
          <div className="relative max-w-[640px]">
            <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search collections…" className="rounded-2xl pl-11" aria-label="Search collections" autoFocus />
          </div>
        </PageHeader>

        {error && <ErrorNote>{error}</ErrorNote>}

        {isLoading ? (
          <SkeletonPosterGrid count={14} />
        ) : trimmed.length < 2 ? (
          <EmptyState icon={LayersIcon} title="Find a franchise" description="TMDB has no browse-all list for collections — search for one by name." />
        ) : results.length === 0 ? (
          <EmptyState icon={SearchIcon} title={`No collections found for “${trimmed}”`} />
        ) : (
          <>
            <PosterGrid>
              {results.map((r) => <CollectionCard key={r.id} id={r.id} name={r.name} posterPath={r.poster_path} />)}
            </PosterGrid>
            <LoadMoreButton onClick={loadMore} loading={isLoadingMore} hasMore={hasMore} />
          </>
        )}
      </PageContainer>
    </AppLayout>
  );
}

export default CollectionsPage;
