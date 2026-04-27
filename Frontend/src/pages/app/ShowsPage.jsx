import AppLayout from "../../layouts/AppLayout.jsx";
import MediaRow from "../../components/home/MediaRow.jsx";
import { useShowsPageData } from "../../features/shows/hooks/useShowsPageData.js";

function SkeletonRow() {
  return (
    <section className="flex flex-col items-center">
      <div className="mb-3 h-6 w-32 animate-pulse rounded bg-[#1e2240]" />
      <div className="flex w-full justify-center gap-3 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-[130px] flex-shrink-0 sm:w-[150px]">
            <div className="aspect-[2/3] animate-pulse rounded-2xl bg-[#1e2240]" />
            <div className="mt-2 h-3 animate-pulse rounded bg-[#1e2240]" />
            <div className="mt-1.5 mx-auto h-5 w-16 animate-pulse rounded-full bg-[#1e2240]" />
          </div>
        ))}
      </div>
    </section>
  );
}

function ShowsPage({ session }) {
  const { popular, byGenre, isLoading, error } = useShowsPageData(session);

  return (
    <AppLayout session={session}>
      <div className="mx-auto max-w-[1600px] space-y-8">
        {error && (
          <p className="text-center text-sm text-red-400">Failed to load shows: {error}</p>
        )}

        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            <MediaRow title="Popular" items={popular} session={session} />
            {byGenre.map(({ genreId, genreName, items }) => (
              <MediaRow key={genreId} title={genreName} items={items} session={session} />
            ))}
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default ShowsPage;
