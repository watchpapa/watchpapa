function DetailPageLayout({ title, followButton, sidebarTop, sidebarBottom, children }) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-extrabold leading-tight text-[#a090ff] sm:text-3xl">{title}</h1>
        {followButton && <div className="flex-shrink-0">{followButton}</div>}
      </div>

      <div className="flex gap-6">
        <aside className="hidden w-[220px] flex-shrink-0 flex-col gap-4 lg:flex">
          {sidebarTop}
          {sidebarBottom && (
            <div className="rounded-2xl border border-[#1a1f3a] bg-[#0d0f1e] p-4">
              {sidebarBottom}
            </div>
          )}
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export default DetailPageLayout;
