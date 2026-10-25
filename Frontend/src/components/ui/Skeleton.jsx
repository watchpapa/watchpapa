import { cn } from "../../lib/cn.js";

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-3", className)} aria-hidden />;
}

// One poster placeholder — same aspect/radius/gap as MediaCard, with its
// centred two-line title block (min-h 2.5em at text-xs).
export function SkeletonPoster({ className }) {
  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-1.5 sm:gap-2", className)} aria-hidden>
      <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
      <div className="flex min-h-[2.5em] flex-col items-center justify-center gap-1.5 text-xs">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

// Fills a poster grid (same column rule as POSTER_GRID_CLASS).
export function SkeletonPosterGrid({ count = 12, className }) {
  return (
    <div
      className={cn(
        "grid gap-2 xs:gap-3 grid-cols-[repeat(auto-fill,minmax(104px,1fr))] xs:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] 3xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPoster key={i} />
      ))}
    </div>
  );
}

// Horizontal poster strip placeholder (MediaRow): size="lg" section title,
// then a row with the same edge bleed/padding and card slot widths.
export function SkeletonPosterRow({ count = 8, title = true, className }) {
  return (
    <div className={className} aria-hidden>
      {title && (
        <div className="mb-3 flex h-7 items-center sm:h-7">
          <Skeleton className="h-6 w-40" />
        </div>
      )}
      <div className="scrollbar-none -mx-3 flex gap-3 overflow-hidden px-3 pb-3 pt-2 sm:-mx-5 sm:px-5 lg:mx-0 lg:px-1">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonPoster key={i} className="w-[104px] shrink-0 xs:w-[112px] sm:w-[132px] lg:w-[150px] 2xl:w-[168px] 3xl:w-[190px]" />
        ))}
      </div>
    </div>
  );
}

// ProfileRatingCard placeholder: bordered card, poster, then a title + meta footer.
export function SkeletonRatingCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-surface" aria-hidden>
      <Skeleton className="aspect-[2/3] w-full rounded-none" />
      <div className="space-y-1.5 p-2">
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3.5 w-3/5" />
      </div>
    </div>
  );
}

export function SkeletonLines({ lines = 3, className }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export default Skeleton;
