import { Link } from "react-router-dom";
import { tmdbImg } from "../../lib/tmdbImage.js";

// Cast avatars scale with the column count so a 6-up desktop grid doesn't
// leave 64px faces floating in wide cells.
function CastGrid({ credits = [] }) {
  if (!credits.length) return null;

  return (
    <div className="grid grid-cols-3 gap-2 xs:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
      {credits.map((credit) => (
        <Link
          key={credit.id}
          to={`/people/${credit.personId}`}
          className="group flex flex-col items-center gap-1.5 rounded-xl p-2 transition hover:-translate-y-0.5 hover:bg-surface-3/60"
        >
          <div className="h-14 w-14 overflow-hidden rounded-full border border-border bg-surface-4 transition group-hover:border-brand sm:h-16 sm:w-16 lg:h-20 lg:w-20">
            {credit.profilePath ? (
              <img src={tmdbImg(credit.profilePath, "w185")} alt={credit.name} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-border-strong">{credit.name?.[0] ?? "?"}</div>
            )}
          </div>
          <p className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-white sm:text-xs">{credit.name}</p>
          {credit.character && <p className="line-clamp-2 text-center text-[10px] leading-tight text-text-dim sm:text-[11px]">{credit.character}</p>}
        </Link>
      ))}
    </div>
  );
}

export default CastGrid;
