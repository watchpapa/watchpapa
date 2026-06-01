function DetailPageLayout({ title, followButton, sidebarTop, sidebarBottom, children }) {
  const hasSidebar = sidebarTop || sidebarBottom;

  const mobileSidebar = hasSidebar && (
    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:gap-3 lg:hidden">
      {sidebarTop && (
        <div className="w-[80px] flex-shrink-0 sm:w-[100px]">
          {sidebarTop}
        </div>
      )}
      {sidebarBottom && (
        <div className="min-w-0 flex-1 rounded-2xl border border-[#2a3570]/50 bg-[#0d0f1e]/70 p-3 backdrop-blur-sm sm:p-4">
          {sidebarBottom}
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Title + follow — sticky on mobile only */}
      <div className="sticky top-14 z-10 -mx-3 mb-4 border-b border-[#2a3570]/40 bg-[#111320]/85 px-3 py-3 backdrop-blur-md sm:-mx-5 sm:px-5 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="flex items-start justify-between gap-4">
          <h1 className="flex min-w-0 flex-1 items-start gap-2.5 break-words text-xl font-extrabold leading-tight text-white sm:text-2xl lg:text-3xl">
            <span className="mt-1 h-7 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#c084fc] to-[#6f6fdc] sm:h-8 lg:h-9" aria-hidden />
            <span className="min-w-0">{title}</span>
          </h1>
          {followButton && <div className="flex-shrink-0">{followButton}</div>}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-6">
        {/* Desktop sidebar (lg+): poster + summary stick while main column scrolls */}
        <aside className="hidden w-[220px] flex-shrink-0 lg:block">
          <div className="sticky top-16 flex flex-col gap-4">
            {sidebarTop}
            {sidebarBottom && (
              <div className="rounded-2xl border border-[#2a3570]/50 bg-[#0d0f1e]/70 p-4 backdrop-blur-sm">
                {sidebarBottom}
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          {mobileSidebar}
          {children}
        </div>
      </div>
    </div>
  );
}

export default DetailPageLayout;
