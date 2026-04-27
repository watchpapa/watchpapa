function SkeletonDetailPage({ withFollow = true }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] animate-pulse px-1">
      {/* Title + follow button */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="h-7 w-56 rounded-lg bg-[#1e2240] sm:h-8 sm:w-72" />
        {withFollow && <div className="h-9 w-24 flex-shrink-0 rounded-full bg-[#1e2240]" />}
      </div>

      {/* Mobile compact: poster + info (hidden on lg+) */}
      <div className="mb-4 flex gap-3 lg:hidden">
        <div className="w-[80px] flex-shrink-0 rounded-2xl bg-[#1e2240] sm:w-[100px]" style={{ aspectRatio: "2/3" }} />
        <div className="flex-1 rounded-2xl bg-[#1e2240]" />
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <div className="hidden w-[220px] flex-shrink-0 flex-col gap-4 lg:flex">
          <div className="w-full rounded-2xl bg-[#1e2240]" style={{ aspectRatio: "2/3" }} />
          <div className="h-36 rounded-2xl bg-[#1e2240]" />
        </div>

        {/* Content panels */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="h-28 rounded-2xl bg-[#1e2240]" />
          <div className="h-20 rounded-2xl bg-[#1e2240]" />
          <div className="h-44 rounded-2xl bg-[#1e2240]" />
        </div>
      </div>
    </div>
  );
}

export default SkeletonDetailPage;
