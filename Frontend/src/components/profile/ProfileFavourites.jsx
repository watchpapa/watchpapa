import { Link } from "react-router-dom";
import { tmdbImg } from "../../lib/tmdbImage.js";


function FavSlot({ fav }) {
  if (!fav) {
    return (
      <div className="aspect-[2/3] w-full rounded-xl border border-dashed border-[#2a2f5a] bg-[#0a0c18]" />
    );
  }

  const isMovie = fav.movie_id != null;
  const item = isMovie ? fav.movie : fav.show;
  const title = isMovie ? item?.title : item?.name;
  const poster = item?.poster_path;
  const to = isMovie ? `/movies/${item?.id}` : `/shows/${item?.id}`;

  return (
    <Link
      to={to}
      className="group relative block aspect-[2/3] w-full overflow-hidden rounded-xl border border-[#2a3570]/50 bg-[#0a0c18] transition hover:border-[#5a5aaa]"
    >
      {poster ? (
        <img
          src={tmdbImg(poster, "w185")}
          alt={title}
          className="h-full w-full object-cover transition group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#3a3a7a] text-xs text-center p-2">
          {title}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
        <p className="truncate text-[10px] font-semibold text-white">{title}</p>
      </div>
    </Link>
  );
}

export function ProfileFavourites({ favourites, isOwn, username }) {
  const slots = [1, 2, 3, 4, 5].map((pos) =>
    favourites.find((f) => f.position === pos) ?? null
  );
  const hasAny = slots.some(Boolean);

  if (!hasAny) return null;

  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#c084fc]">{isOwn ? "Your" : `@${username}`} Favourites</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {slots.map((fav, i) => (
          <FavSlot key={i} fav={fav} />
        ))}
      </div>
    </div>
  );
}
