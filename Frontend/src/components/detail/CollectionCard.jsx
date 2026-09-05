import { Link } from "react-router-dom";
import { tmdbImg } from "../../lib/tmdbImage.js";

// Poster + name only — a collection has no follow/watchlist/rating affordances,
// so it doesn't belong to components/home/MediaCard.jsx (movie/show specific:
// hardcoded "Movie"/"Show" type badge, follow button, NSFW blur).
function CollectionCard({ id, name, posterPath }) {
  const imgSrc = posterPath ? tmdbImg(posterPath, "w300") : null;

  return (
    <Link
      to={`/collections/${id}`}
      className="group/card flex w-[100px] flex-shrink-0 flex-col gap-1.5 sm:w-[132px] sm:gap-2 lg:w-[150px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-[#2a3570] bg-[#12163a] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)] transition duration-300 group-hover/card:-translate-y-1 group-hover/card:border-[#6f6fdc] group-hover/card:shadow-[0_18px_38px_-12px_rgba(111,111,220,0.55)]">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.07]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#181d40] to-[#0e1128] px-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3a3a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path d="M8 6V4M16 6V4M2 10h20" />
            </svg>
            <span className="text-center text-xs font-medium leading-tight text-[#3a3a7a] line-clamp-3">{name}</span>
          </div>
        )}
      </div>
      <p className="truncate text-xs font-semibold text-white sm:text-sm">{name}</p>
    </Link>
  );
}

export default CollectionCard;
