import { useEffect, useRef, useState } from "react";
import DetailHero from "./DetailHero.jsx";

// Detail page shell (movie / show / season / episode / person).
//   <lg : hero (backdrop + poster + title + actions) → activity panel → content
//   lg+ : hero (title + actions) over a 264px sticky sidebar (poster + panel) + content
// The panel is mounted exactly once (in the aside, which is a full-width
// block below `lg`) so its hooks never diverge between two copies. A slim
// title bar slides in under the header once the hero scrolls away — on every
// breakpoint, so the title (and, on lg+, the sticky sidebar) is never just
// "gone" once you've scrolled past it.
function DetailPageLayout({ title, subtitle, meta, backdropPath, poster, actions, panel, children }) {
  const heroRef = useRef(null);
  const [heroGone, setHeroGone] = useState(false);

  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([entry]) => setHeroGone(!entry.isIntersecting), { rootMargin: "-56px 0px 0px 0px", threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] 3xl:max-w-[1600px]">
      {/* `fixed` has zero footprint in the document — nothing pushes down to
          make room for it. Without the matching top padding below, this bar
          would sit right on top of (hide behind itself) whatever content the
          page happened to be scrolled to the instant it fades in. */}
      <div
        aria-hidden={!heroGone}
        className={`pointer-events-none fixed inset-x-0 top-14 z-30 border-b border-border/40 bg-surface/90 backdrop-blur-md transition-all duration-200 landscape-short:top-12 ${
          heroGone ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        <p className="truncate px-4 py-2 text-sm font-bold text-white sm:px-6">{title}</p>
      </div>

      <DetailHero heroRef={heroRef} title={title} subtitle={subtitle} meta={meta} backdropPath={backdropPath} poster={poster} actions={actions} />

      <div className={`flex flex-col gap-4 lg:flex-row lg:gap-6 ${heroGone ? "pt-10" : ""}`}>
        {(poster || panel) && (
          // 264/284px, not 240/260 — the panel's 5-heart rating row (5×40px
          // + gaps ≈ 210px) plus its own p-4 padding left almost no margin
          // at 240px: any rendering variance overflowed the sidebar's own
          // box and bled into the content column next to it (flex children
          // don't clip by default). This leaves real breathing room.
          <aside className="w-full shrink-0 lg:w-[264px] xl:w-[284px]">
            {/* A sticky element is pinned at a fixed screen position while
                "stuck" — it does not reveal more of itself as you scroll the
                page. With the poster plus a rating card that can grow
                (rating/watch history, observed ratings all expand in place),
                the column can end up taller than the viewport, permanently
                hiding whatever's below the fold until it un-sticks near the
                very bottom of a long page. Capping its own height and
                scrolling internally means expanding a panel scrolls the
                sidebar, never hides the rest of it. */}
            <div
              className={`flex flex-col gap-4 overflow-y-auto overscroll-contain lg:sticky ${
                heroGone ? "lg:top-24 lg:max-h-[calc(100svh-7rem)]" : "lg:top-16 lg:max-h-[calc(100svh-5rem)]"
              }`}
            >
              {poster && <div className="hidden lg:block">{poster}</div>}
              {panel}
            </div>
          </aside>
        )}
        <div className="min-w-0 flex-1 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export default DetailPageLayout;
