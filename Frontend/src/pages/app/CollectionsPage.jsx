import { useState } from "react";
import AppLayout from "../../layouts/AppLayout.jsx";
import Input from "../../components/ui/Input.jsx";
import CollectionCard from "../../components/detail/CollectionCard.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useCollectionSearch } from "../../features/collection/hooks/useCollectionSearch.js";

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] animate-pulse rounded-2xl bg-[#1e2240]" />
          <div className="mt-2 h-3 animate-pulse rounded bg-[#1e2240]" />
        </div>
      ))}
    </div>
  );
}

function CollectionsPage({ session }) {
  const [query, setQuery] = useState("");
  const { results, isLoading, isLoadingMore, error, hasMore, loadMore } = useCollectionSearch(query);
  const trimmed = query.trim();

  return (
    <AppLayout session={session}>
      <PageHead
        title="Collections"
        description="Search movie franchises and collections on watchpapa."
        path="/collections"
      />
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-extrabold text-white">Collections</h1>
          <p className="max-w-md text-sm text-[#8888c8]">
            Search for a franchise (e.g. "Alien", "James Bond") to see every film in it.
          </p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search collections…"
            className="max-w-md text-base font-semibold"
          />
        </div>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        {isLoading ? (
          <SkeletonGrid />
        ) : trimmed.length < 2 ? null : results.length === 0 ? (
          <p className="text-center text-sm text-[#6868b8]">No collections found for "{trimmed}".</p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
              {results.map((r) => (
                <CollectionCard key={r.id} id={r.id} name={r.name} posterPath={r.poster_path} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="flex items-center gap-2 rounded-full border border-[#2a3570] bg-[#141728] px-6 py-2 text-sm font-semibold text-[#8888c8] transition hover:border-[#5050a0] hover:text-white disabled:opacity-60"
                >
                  {isLoadingMore ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#8888c8] border-t-transparent" aria-hidden />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default CollectionsPage;
