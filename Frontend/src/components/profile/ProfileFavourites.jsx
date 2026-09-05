import { Link } from "react-router-dom";
import { tmdbImg } from "../../lib/tmdbImage.js";
import SectionTitle from "../ui/SectionTitle.jsx";

function FavSlot({ fav }) {
  if (!fav) return <div className="aspect-[2/3] w-full rounded-xl border border-dashed border-border/60 bg-surface" />;

  const isMovie = fav.movie_id != null;
  const item = isMovie ? fav.movie : fav.show;
  const title = isMovie ? item?.title : item?.name;
  const poster = item?.poster_path;
  const to = isMovie ? `/movies/${item?.id}` : `/shows/${item?.id}`;

  return (
    <Link to={to} className="group relative block aspect-[2/3] w-full overflow-hidden rounded-xl border border-border/50 bg-surface transition hover:border-brand" title={title}>
      {poster ? (
        <img src={tmdbImg(poster, "w342")} alt={title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-border-strong">{title}</div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
        <p className="truncate text-[11px] font-semibold text-white">{title}</p>
      </div>
    </Link>
  );
}

export function ProfileFavourites({ favourites, isOwn, username }) {
  const slots = [1, 2, 3, 4, 5].map((pos) => favourites.find((f) => f.position === pos) ?? null);
  if (!slots.some(Boolean)) return null;

  return (
    <section>
      <SectionTitle>{isOwn ? "Your favourites" : `@${username}'s favourites`}</SectionTitle>
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {slots.map((fav, i) => <FavSlot key={i} fav={fav} />)}
      </div>
    </section>
  );
}
