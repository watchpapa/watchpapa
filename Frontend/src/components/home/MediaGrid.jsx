import MediaCard from "./MediaCard.jsx";

function MediaGrid({ title, items, session, onLoadMore, hasMore = false, isLoadingMore = false }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-extrabold tracking-tight" style={{ color: "#e8c04a" }}>
        {title}
      </h2>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
        {items.map((item) => (
          <MediaCard key={`${item.type}-${item.id}`} {...item} isAuthenticated={!!session} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
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
    </section>
  );
}

export default MediaGrid;
