import { cn } from "../../lib/cn.js";

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-3", className)} aria-hidden />;
}

// One poster placeholder — same aspect/radius as MediaCard.
export function SkeletonPoster({ className }) {
  return (
    <div className={cn("w-full", className)} aria-hidden>
      <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
      <Skeleton className="mt-2 h-3 w-3/4" />
      <Skeleton className="mt-1.5 h-3 w-1/2" />
    </div>
  );
}

// Fills a poster grid (same column rule as PosterGrid).
export function SkeletonPosterGrid({ count = 12, className }) {
  return (
    <div
      className={cn(
        "grid gap-2 xs:gap-3 grid-cols-[repeat(auto-fill,minmax(104px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] 3xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]",
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

// Horizontal poster strip placeholder (MediaRow).
export function SkeletonPosterRow({ count = 8, title = true, className }) {
  return (
    <div className={className} aria-hidden>
      {title && <Skeleton className="mb-3 h-5 w-40" />}
      <div className="scrollbar-none flex gap-3 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonPoster key={i} className="w-[104px] shrink-0 sm:w-[132px] lg:w-[150px] 2xl:w-[168px]" />
        ))}
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
