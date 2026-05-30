import { Link } from "react-router-dom";
import { HeartDisplay } from "../rating/HeartDisplay.jsx";

const TMDB_IMG = "https://image.tmdb.org/t/p/w185";

const TYPE_BADGE = {
  movie: { label: "Movie", color: "text-sky-400 border-sky-900/50 bg-sky-900/20" },
  show: { label: "Show", color: "text-violet-400 border-violet-900/50 bg-violet-900/20" },
  season: { label: "Season", color: "text-amber-400 border-amber-900/50 bg-amber-900/20" },
  episode: { label: "Episode", color: "text-green-400 border-green-900/50 bg-green-900/20" },
};

function getItemMeta(rating) {
  if (rating.movie_id && rating.movie) {
    return {
      type: "movie",
      title: rating.movie.title,
      poster: rating.movie.poster_path,
      year: rating.movie.release_date?.slice(0, 4),
      to: `/movies/${rating.movie.id}`,
    };
  }
  if (rating.show_id && rating.show) {
    return {
      type: "show",
      title: rating.show.name,
      poster: rating.show.poster_path,
      year: rating.show.first_air_date?.slice(0, 4),
      to: `/shows/${rating.show.id}`,
    };
  }
  if (rating.season_id && rating.season) {
    const show = rating.season.show;
    return {
      type: "season",
      title: `${show?.name ?? "Unknown Show"} — ${rating.season.name}`,
      poster: rating.season.poster_path ?? show?.poster_path,
      year: rating.season.air_date?.slice(0, 4),
      to: `/shows/${show?.id}/seasons/${rating.season.id}`,
    };
  }
  if (rating.episode_id && rating.episode) {
    const show = rating.episode.season?.show;
    return {
      type: "episode",
      title: `${show?.name ?? "Unknown Show"} — ${rating.episode.name}`,
      poster: show?.poster_path,
      year: rating.episode.air_date?.slice(0, 4),
      to: `/shows/${show?.id}`,
    };
  }
  return null;
}

export function ProfileRatingCard({ rating }) {
  const meta = getItemMeta(rating);
  if (!meta) return null;
  const badge = TYPE_BADGE[meta.type];

  return (
    <Link
      to={meta.to}
      className="group flex flex-col overflow-hidden rounded-xl border border-[#1a1f3a] bg-[#0a0c18] transition hover:border-[#3a3a7a]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#0d0f1e]">
        {meta.poster ? (
          <img
            src={`${TMDB_IMG}${meta.poster}`}
            alt={meta.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[#3a3a7a]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
        )}
        {/* Rating overlay */}
        <div className="absolute bottom-0 inset-x-0 flex items-center gap-1 bg-gradient-to-t from-black/90 to-transparent px-2 pb-2 pt-6">
          <HeartDisplay value={rating.value} size="sm" />
          <span className="text-[10px] font-bold text-white">{rating.value}/10</span>
        </div>
      </div>
      <div className="p-2">
        <p className="truncate text-xs font-semibold text-white leading-tight">{meta.title}</p>
        <div className="mt-1 flex items-center gap-1.5">
          {meta.year && <span className="text-[10px] text-[#6868b8]">{meta.year}</span>}
          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
    </Link>
  );
}
