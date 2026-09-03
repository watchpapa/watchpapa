import { Link } from "react-router-dom";
import { tmdbImg } from "../../lib/tmdbImage.js";


function CastGrid({ credits = [] }) {
  if (!credits.length) return null;

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {credits.map((credit) => (
        <Link
          key={credit.id}
          to={`/people/${credit.personId}`}
          className="group flex flex-col items-center gap-1.5 rounded-xl p-2 transition hover:-translate-y-0.5 hover:bg-[#1a1f3a]"
        >
          <div className="h-16 w-16 overflow-hidden rounded-full border border-[#2a3570] bg-[#12163a] transition group-hover:border-[#6f6fdc]">
            {credit.profilePath ? (
              <img
                src={tmdbImg(credit.profilePath, "w185")}
                alt={credit.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-[#3a3a7a]">
                {credit.name?.[0] ?? "?"}
              </div>
            )}
          </div>
          <p className="text-center text-[11px] font-semibold leading-tight text-white line-clamp-2">{credit.name}</p>
          {credit.character && (
            <p className="text-center text-[10px] leading-tight text-[#6868b8] line-clamp-2">{credit.character}</p>
          )}
        </Link>
      ))}
    </div>
  );
}

export default CastGrid;
