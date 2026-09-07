import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import MediaCard from "./MediaCard.jsx";
import SectionTitle from "../ui/SectionTitle.jsx";
import { ChevronLeftIcon, ChevronRightIcon, SpinnerIcon } from "../icons/index.jsx";
import { cn } from "../../lib/cn.js";
import { useRowScrollRestore } from "../../hooks/index.js";

const SCROLL_EDGE = 8;
const LOAD_MORE_SCROLL_THRESHOLD = 72;
const MOBILE_LOAD_DEBOUNCE_MS = 400;

// Card slot width per breakpoint — MediaCard itself is fluid (w-full).
export const ROW_SLOT_CLASS = "w-[104px] shrink-0 snap-start xs:w-[112px] sm:w-[132px] lg:w-[150px] 2xl:w-[168px] 3xl:w-[190px]";

// Horizontal poster strip. Touch: swipe with scroll-snap, loads more at the
// end. Pointer devices (lg+): hover chevrons; the right one also loads more.
function MediaRow({ title, items, session, onLoadMore, hasMore = false, isLoadingMore = false, action, rowKey }) {
  const scrollRef = useRef(null);
  const loadMoreTimerRef = useRef(null);
  const loadMoreTriggeredRef = useRef(false);

  useRowScrollRestore(scrollRef, rowKey ?? title, items.length > 0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const updateArrowVisibility = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftArrow(scrollLeft > SCROLL_EDGE);
    setShowRightArrow(scrollLeft + clientWidth < scrollWidth - SCROLL_EDGE || hasMore);
  }, [hasMore]);

  useLayoutEffect(() => {
    updateArrowVisibility();
  }, [items.length, updateArrowVisibility]);

  // If the row doesn't overflow on a phone (few cards), fetch more so the
  // scroll-end loader is reachable.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !onLoadMore || !hasMore || isLoadingMore) return;
    if (window.matchMedia("(min-width: 768px)").matches) return;
    if (el.scrollWidth <= el.clientWidth + 8) onLoadMore();
  }, [items.length, hasMore, isLoadingMore, onLoadMore]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => updateArrowVisibility());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateArrowVisibility]);

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
    if (!isLoadingMore) loadMoreTriggeredRef.current = false;
  }, [isLoadingMore]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      updateArrowVisibility();
      if (window.matchMedia("(min-width: 1024px)").matches) return;
      window.clearTimeout(loadMoreTimerRef.current);
      loadMoreTimerRef.current = window.setTimeout(() => {
        loadMoreTimerRef.current = null;
        tryLoadMoreAtScrollEnd();
      }, MOBILE_LOAD_DEBOUNCE_MS);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearTimeout(loadMoreTimerRef.current);
    };
  }, [updateArrowVisibility, tryLoadMoreAtScrollEnd]);

  const delta = () => Math.max(240, (scrollRef.current?.clientWidth ?? 480) * 0.8);
  const scrollLeftBy = () => scrollRef.current?.scrollBy({ left: -delta(), behavior: "smooth" });
  const scrollRightBy = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - SCROLL_EDGE;
    if (atEnd && hasMore && onLoadMore) { onLoadMore(); return; }
    el.scrollBy({ left: delta(), behavior: "smooth" });
  };

  const arrowClass = "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface-2/90 text-[#a78bfa] shadow-lg backdrop-blur-sm transition hover:border-brand hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-0 lg:flex";

  return (
    <section className="group/row">
      <SectionTitle size="lg" action={action}>{title}</SectionTitle>
      <div className="relative">
        <button type="button" onClick={scrollLeftBy} aria-label="Scroll left" disabled={!showLeftArrow} className={cn(arrowClass, "-left-3 xl:-left-5", showLeftArrow ? "lg:opacity-0 lg:group-hover/row:opacity-100 lg:focus-visible:opacity-100" : "")}>
          <ChevronLeftIcon size={20} strokeWidth={2.5} />
        </button>

        <div
          ref={scrollRef}
          className="scrollbar-none -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden px-3 pb-3 pt-2 sm:-mx-5 sm:px-5 lg:mx-0 lg:snap-none lg:px-1"
        >
          {items.map((item) => (
            <div key={`${item.type}-${item.id}`} className={ROW_SLOT_CLASS}>
              <MediaCard {...item} isAuthenticated={!!session} />
            </div>
          ))}
          {isLoadingMore && (
            <div className={cn(ROW_SLOT_CLASS, "flex aspect-[2/3] items-center justify-center text-text-dim")} aria-hidden>
              <SpinnerIcon size={22} />
            </div>
          )}
        </div>

        <button type="button" onClick={scrollRightBy} aria-label={hasMore ? "Scroll right or load more" : "Scroll right"} disabled={!showRightArrow || isLoadingMore} className={cn(arrowClass, "-right-3 xl:-right-5", showRightArrow ? "lg:opacity-0 lg:group-hover/row:opacity-100 lg:focus-visible:opacity-100" : "")}>
          {isLoadingMore ? <SpinnerIcon size={16} /> : <ChevronRightIcon size={20} strokeWidth={2.5} />}
        </button>
      </div>
    </section>
  );
}

export default MediaRow;
