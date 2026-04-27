import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import MediaCard from "./MediaCard.jsx";

const SCROLL_EDGE = 8;
const LOAD_MORE_SCROLL_THRESHOLD = 72;
const MOBILE_LOAD_DEBOUNCE_MS = 400;

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function MediaRow({ title, items, session, onLoadMore, hasMore = false, isLoadingMore = false }) {
  const scrollRef = useRef(null);
  const loadMoreTimerRef = useRef(null);
  const loadMoreTriggeredRef = useRef(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scrollDelta =
    typeof window !== "undefined" && window.innerWidth < 768 ? 280 : 480;

  const updateArrowVisibility = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const atStart = scrollLeft <= SCROLL_EDGE;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - SCROLL_EDGE;
    setShowLeftArrow(!atStart);
    setShowRightArrow(!atEnd || hasMore);
  }, [hasMore]);

  useLayoutEffect(() => {
    updateArrowVisibility();
  }, [items.length, updateArrowVisibility]);

  /** If the row does not overflow (e.g. wide screen or few cards), still fetch more on mobile so users can reach scroll-end loading. */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !onLoadMore || !hasMore || isLoadingMore) return;
    if (window.matchMedia("(min-width: 768px)").matches) return;
    if (el.scrollWidth <= el.clientWidth + 8) {
      onLoadMore();
    }
  }, [items.length, hasMore, isLoadingMore, onLoadMore]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => updateArrowVisibility());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateArrowVisibility]);

  const clearLoadMoreDebounce = () => {
    if (loadMoreTimerRef.current != null) {
      window.clearTimeout(loadMoreTimerRef.current);
      loadMoreTimerRef.current = null;
    }
  };

  const tryLoadMoreAtScrollEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !onLoadMore || !hasMore || isLoadingMore) return;
    if (el.scrollLeft + el.clientWidth < el.scrollWidth - LOAD_MORE_SCROLL_THRESHOLD) {
      loadMoreTriggeredRef.current = false;
      return;
    }
    if (loadMoreTriggeredRef.current) return;
    loadMoreTriggeredRef.current = true;
    onLoadMore();
  }, [onLoadMore, hasMore, isLoadingMore]);

  useEffect(() => {
    if (!isLoadingMore) {
      loadMoreTriggeredRef.current = false;
    }
  }, [isLoadingMore]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;

    const onScroll = () => {
      updateArrowVisibility();
      if (isDesktop()) return;
      clearLoadMoreDebounce();
      loadMoreTimerRef.current = window.setTimeout(() => {
        loadMoreTimerRef.current = null;
        tryLoadMoreAtScrollEnd();
      }, MOBILE_LOAD_DEBOUNCE_MS);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearLoadMoreDebounce();
    };
  }, [updateArrowVisibility, tryLoadMoreAtScrollEnd]);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -scrollDelta, behavior: "smooth" });
  };

  const scrollRight = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atEnd =
      el.scrollLeft + el.clientWidth >= el.scrollWidth - SCROLL_EDGE;
    if (atEnd && hasMore && onLoadMore) {
      onLoadMore();
      return;
    }
    el.scrollBy({ left: scrollDelta, behavior: "smooth" });
  };

  return (
    <section>
      {/* Match desktop left control (w-10 + mr-3) so the title lines up with the first poster */}
      <div className="mb-3 flex min-w-0 items-baseline">
        <div className="pointer-events-none hidden w-10 shrink-0 md:mr-3 md:block" aria-hidden />
        <h2 className="min-w-0 text-xl font-extrabold tracking-tight" style={{ color: "#e8c04a" }}>
          {title}
        </h2>
      </div>

      <div className="relative flex items-center">
        <button
          type="button"
          onClick={scrollLeft}
          aria-label="Scroll left"
          disabled={!showLeftArrow}
          className={`mr-3 hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#2a3570] bg-[#141728] text-[#8888c8] transition hover:border-[#5050a0] hover:text-white disabled:pointer-events-none disabled:opacity-0 md:flex ${showLeftArrow ? "" : "invisible"}`}
        >
          <ChevronLeft />
        </button>

        <div
          ref={scrollRef}
          className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-2 scrollbar-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => (
            <MediaCard key={`${item.type}-${item.id}`} {...item} isAuthenticated={!!session} />
          ))}
        </div>

        <button
          type="button"
          onClick={scrollRight}
          aria-label={hasMore ? "Scroll right or load more" : "Scroll right"}
          disabled={!showRightArrow || isLoadingMore}
          className={`ml-3 hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#2a3570] bg-[#141728] text-[#8888c8] transition hover:border-[#5050a0] hover:text-white disabled:pointer-events-none md:flex ${!showRightArrow ? "invisible" : isLoadingMore ? "opacity-70" : ""}`}
        >
          {isLoadingMore ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#8888c8] border-t-transparent" aria-hidden />
          ) : (
            <ChevronRight />
          )}
        </button>
      </div>
    </section>
  );
}

export default MediaRow;
