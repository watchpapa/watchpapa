import { useEffect, useRef, useState } from "react";
import DetailHero from "./DetailHero.jsx";

// Detail page shell (movie / show / season / episode / person).
//   <lg : hero (backdrop + poster + title + actions) → activity panel → content
//   lg+ : hero (title + actions) over a 240px sticky sidebar (poster + panel) + content
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
          <aside className="w-full shrink-0 lg:w-[240px] xl:w-[260px]">
            <div className={`flex flex-col gap-4 lg:sticky ${heroGone ? "lg:top-24" : "lg:top-16"}`}>
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
