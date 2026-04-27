import { Link } from "react-router-dom";

const TMDB_IMG = "https://image.tmdb.org/t/p/w185";

function CastGrid({ credits = [] }) {
  if (!credits.length) return null;

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {credits.map((credit) => (
        <Link
          key={credit.id}
          to={`/people/${credit.personId}`}
          className="flex flex-col items-center gap-1.5 rounded-xl p-2 transition hover:bg-[#1a1f3a]"
        >
          <div className="h-16 w-16 overflow-hidden rounded-full border border-[#2a3570] bg-[#12163a]">
            {credit.profilePath ? (
              <img
                src={`${TMDB_IMG}${credit.profilePath}`}
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
