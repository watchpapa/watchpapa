import { Link } from "react-router-dom";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MediaCard({ id, type, title, posterPath, isFollowing = false, onFollowToggle }) {
  const imgSrc = posterPath ? `${TMDB_IMG}${posterPath}` : null;
  const to = type === "movie" ? `/movies/${id}` : `/shows/${id}`;

  return (
    <article className="flex w-[130px] flex-shrink-0 flex-col gap-2 sm:w-[150px]">
      <Link to={to} className="relative overflow-hidden rounded-2xl border border-[#2a3570] bg-[#12163a] aspect-[2/3] block">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#181d40] to-[#0e1128] px-3">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path d="M8 6V4M16 6V4M2 10h20" />
            </svg>
            <span className="text-center text-[11px] font-medium leading-tight text-[#3a3a7a] line-clamp-3">{title}</span>
          </div>
        )}
      </Link>

      <p className="text-center text-xs font-semibold leading-tight text-white line-clamp-2 min-h-[2.5em]">
        {title}
      </p>

      <button
        onClick={onFollowToggle}
        className={`mx-auto flex items-center gap-1 rounded-full border px-3 py-0.5 text-[11px] font-bold transition ${
          isFollowing
            ? "border-[#5050b0] bg-[#2a2d60] text-[#a0a0e8]"
            : "border-[#3a3a7a] bg-[#1a1d35] text-[#8888c8] hover:border-[#6060b0] hover:text-white"
        }`}
      >
        Follow
        {!isFollowing && <PlusIcon />}
      </button>
    </article>
  );
}

export default MediaCard;
