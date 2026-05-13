function DetailPageLayout({ title, followButton, sidebarTop, sidebarBottom, children }) {
  const hasSidebar = sidebarTop || sidebarBottom;

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Title + follow button */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <h1 className="text-xl font-extrabold leading-tight text-[#a090ff] sm:text-2xl lg:text-3xl">{title}</h1>
        {followButton && <div className="flex-shrink-0">{followButton}</div>}
      </div>

      {/* Mobile compact: small poster + key info stay pinned under navbar while scrolling panels below */}
      {hasSidebar && (
        <div className="sticky top-14 z-10 mb-4 flex gap-3 border-b border-[#1a1f3a] bg-[#111320] py-3 lg:hidden">
          {sidebarTop && (
            <div className="w-[80px] flex-shrink-0 sm:w-[100px]">
              {sidebarTop}
            </div>
          )}
          {sidebarBottom && (
            <div className="min-w-0 flex-1 rounded-2xl border border-[#1a1f3a] bg-[#0d0f1e] p-3">
              {sidebarBottom}
            </div>
          )}
        </div>
      )}

      {/* Main layout */}
      <div className="flex gap-6">
        {/* Desktop sidebar (lg+): poster + summary stick while main column scrolls */}
        <aside className="hidden w-[220px] flex-shrink-0 lg:block">
          <div className="sticky top-16 flex flex-col gap-4">
            {sidebarTop}
            {sidebarBottom && (
              <div className="rounded-2xl border border-[#1a1f3a] bg-[#0d0f1e] p-4">
                {sidebarBottom}
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export default DetailPageLayout;
