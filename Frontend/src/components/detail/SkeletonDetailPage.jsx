import { Skeleton } from "../ui/Skeleton.jsx";

// Mirrors DetailPageLayout: hero (poster + title + actions) → panel → content.
function SkeletonDetailPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] 3xl:max-w-[1600px]" aria-busy="true" aria-label="Loading">
      <div className="-mx-3 mb-4 flex gap-4 bg-surface/60 px-3 py-4 sm:-mx-5 sm:px-5 sm:py-6 lg:mx-0 lg:rounded-3xl lg:px-6">
        <Skeleton className="aspect-[2/3] w-[104px] shrink-0 rounded-2xl xs:w-[120px] sm:w-[150px] lg:hidden" />
        <div className="flex min-w-0 flex-1 flex-col justify-end gap-3">
          <Skeleton className="h-7 w-2/3 sm:h-9" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex gap-6">
        <div className="hidden w-[264px] shrink-0 flex-col gap-4 lg:flex xl:w-[284px]">
          <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <Skeleton className="h-48 rounded-2xl lg:hidden" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default SkeletonDetailPage;
