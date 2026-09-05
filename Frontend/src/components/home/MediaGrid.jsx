import MediaCard from "./MediaCard.jsx";
import PosterGrid from "./PosterGrid.jsx";
import SectionTitle from "../ui/SectionTitle.jsx";
import LoadMoreButton from "../ui/LoadMoreButton.jsx";

function MediaGrid({ title, items, session, onLoadMore, hasMore = false, isLoadingMore = false, count }) {
  return (
    <section>
      {title && <SectionTitle size="lg" count={count}>{title}</SectionTitle>}
      <PosterGrid>
        {items.map((item) => (
          <MediaCard key={`${item.type}-${item.id}`} {...item} isAuthenticated={!!session} />
        ))}
      </PosterGrid>
      <LoadMoreButton onClick={onLoadMore} loading={isLoadingMore} hasMore={hasMore && !!onLoadMore} className="mt-6" />
    </section>
  );
}

export default MediaGrid;
