import { tmdbImg } from "../../lib/tmdbImage.js";
import { cn } from "../../lib/cn.js";

// Title block for detail pages: blurred backdrop, poster (below `lg` — on
// desktop the poster lives in the sidebar), title, meta chips, action buttons.
//   meta — array of strings/nodes rendered as "a · b · c"
function DetailHero({ title, subtitle, meta = [], backdropPath, poster, actions, heroRef, className }) {
  const backdrop = backdropPath ? tmdbImg(backdropPath, "w780") : null;
  const metaItems = meta.filter(Boolean);

  return (
    <section
      ref={heroRef}
      className={cn(
        "relative -mx-3 mb-4 overflow-hidden sm:-mx-5 lg:mx-0 lg:rounded-3xl lg:border lg:border-border/40",
        className,
      )}
    >
      {backdrop && (
        <div className="absolute inset-0" aria-hidden>
          <img src={backdrop} alt="" className="h-full w-full scale-105 object-cover opacity-40 blur-[3px]" loading="eager" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/50" />
        </div>
      )}
      <div className={cn("relative flex gap-4 px-3 py-4 sm:gap-5 sm:px-5 sm:py-6 lg:px-6", !backdrop && "bg-surface/60")}>
        {poster && <div className="w-[104px] shrink-0 xs:w-[120px] sm:w-[150px] lg:hidden">{poster}</div>}
        <div className="flex min-w-0 flex-1 flex-col justify-end">
          {subtitle && <div className="mb-1 text-xs font-semibold text-text-muted sm:text-sm">{subtitle}</div>}
          <h1 className="break-words text-xl font-extrabold leading-tight text-white sm:text-3xl lg:text-4xl">{title}</h1>
          {metaItems.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted sm:text-sm">
              {metaItems.map((m, i) => (
                <span key={i} className="flex items-center gap-x-2">
                  {i > 0 && <span className="text-text-faint" aria-hidden>·</span>}
                  {m}
                </span>
              ))}
            </div>
          )}
          {actions && <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">{actions}</div>}
        </div>
      </div>
    </section>
  );
}

export default DetailHero;
