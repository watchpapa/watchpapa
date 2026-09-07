import { useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import PosterCard from "../../components/detail/PosterCard.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import MediaGrid from "../../components/home/MediaGrid.jsx";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import { useCollectionData } from "../../features/collection/hooks/useCollectionData.js";
import { tmdbImg } from "../../lib/tmdbImage.js";

function CollectionPage({ session }) {
  const { id } = useParams();
  const { collection, items, isLoading, error, followLimitError, clearFollowLimitError } = useCollectionData(id, session);

  const breadcrumbs = [{ label: "Collections", to: "/collections" }, ...(collection ? [{ label: collection.name }] : [])];

  if (isLoading) return <AppLayout session={session} breadcrumbs={breadcrumbs}><SkeletonDetailPage /></AppLayout>;
  if (error) return <AppLayout session={session} breadcrumbs={breadcrumbs}><ErrorNote className="mt-12">{error}</ErrorNote></AppLayout>;
  if (!collection) return null;

  const ogImage = tmdbImg(collection.backdrop_path, "w1280") ?? tmdbImg(collection.poster_path, "w500");
  const years = items.map((i) => i.date?.slice(0, 4)).filter(Boolean).sort();
  const span = years.length ? (years[0] === years[years.length - 1] ? years[0] : `${years[0]}–${years[years.length - 1]}`) : null;

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead title={collection.name} description={collection.overview?.slice(0, 155) || `Every film in the ${collection.name}.`} image={ogImage} path={`/collections/${id}`} />
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      <DetailPageLayout
        title={collection.name}
        subtitle="Collection"
        meta={[items.length > 0 && <span key="n">{items.length} film{items.length !== 1 ? "s" : ""}</span>, span && <span key="y">{span}</span>]}
        backdropPath={collection.backdrop_path}
        poster={<PosterCard title={collection.name} posterPath={collection.poster_path} />}
      >
        {collection.overview && (
          <ContentPanel label="Overview">
            <p className="text-sm leading-relaxed text-text">{collection.overview}</p>
          </ContentPanel>
        )}
        {items.length > 0 && <MediaGrid title="Films in this collection" items={items} session={session} />}
      </DetailPageLayout>
    </AppLayout>
  );
}

export default CollectionPage;
