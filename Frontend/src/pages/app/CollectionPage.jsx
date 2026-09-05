import { useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import PosterCard from "../../components/detail/PosterCard.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import MediaGrid from "../../components/home/MediaGrid.jsx";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useCollectionData } from "../../features/collection/hooks/useCollectionData.js";
import { tmdbImg } from "../../lib/tmdbImage.js";

function CollectionPage({ session }) {
  const { id } = useParams();
  const { collection, items, isLoading, error, followLimitError, clearFollowLimitError } = useCollectionData(id, session);

  if (isLoading) return <AppLayout session={session}><SkeletonDetailPage /></AppLayout>;
  if (error) return <AppLayout session={session}><p className="text-center text-red-400 mt-12">{error}</p></AppLayout>;
  if (!collection) return null;

  const ogImage = tmdbImg(collection.backdrop_path, "w1280") ?? tmdbImg(collection.poster_path, "w500");

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Movies", to: "/movies" }, { label: collection.name }]}>
      <PageHead
        title={collection.name}
        description={collection.overview?.slice(0, 155) || `Every film in the ${collection.name}.`}
        image={ogImage}
        path={`/collections/${id}`}
      />
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex gap-6">
          <div className="w-[120px] flex-shrink-0 sm:w-[160px] lg:w-[200px]">
            <PosterCard title={collection.name} posterPath={collection.poster_path} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="mb-3 flex items-start gap-2.5 break-words text-xl font-extrabold leading-tight text-white sm:text-2xl lg:text-3xl">
              <span className="mt-1 h-7 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#c084fc] to-[#6f6fdc] sm:h-8" aria-hidden />
              <span>{collection.name}</span>
            </h1>
            {collection.overview && (
              <ContentPanel label="Overview">
                <p className="text-sm leading-relaxed text-[#c0c0e8]">{collection.overview}</p>
              </ContentPanel>
            )}
          </div>
        </div>

        {items.length > 0 && <MediaGrid title="Films in this Collection" items={items} session={session} />}
      </div>
    </AppLayout>
  );
}

export default CollectionPage;
