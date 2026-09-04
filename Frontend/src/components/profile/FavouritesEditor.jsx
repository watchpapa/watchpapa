import { useState } from "react";
import { tmdbImg } from "../../lib/tmdbImage.js";
import MediaSearchModal from "../ui/MediaSearchModal.jsx";

// 5-slot favourites editor used on /profile/edit.
// favourites + setFavourite come from useEditProfile.
export function FavouritesEditor({ favourites, setFavourite }) {
  const [pickingSlot, setPickingSlot] = useState(null);

  const handleSelect = async (item) => {
    await setFavourite(pickingSlot, item);
    setPickingSlot(null);
  };

  const slots = [1, 2, 3, 4, 5].map((pos) =>
    favourites.find((f) => f.position === pos) ?? null
  );

  return (
    <>
      {pickingSlot !== null && (
        <MediaSearchModal onSelect={handleSelect} onClose={() => setPickingSlot(null)} />
      )}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#c084fc]">5 Favourites</p>
        <p className="mb-3 text-xs text-[#5050a0]">Mixed movies and shows. Click a slot to change it.</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {slots.map((fav, i) => {
            const pos = i + 1;
            const item = fav?.movie ?? fav?.show;
            const title = fav?.movie ? fav.movie.title : fav?.show?.name;
            const poster = item?.poster_path;

            return (
              <div key={pos} className="relative">
                <button
                  onClick={() => setPickingSlot(pos)}
                  className="group relative block aspect-[2/3] w-full overflow-hidden rounded-xl border border-dashed border-[#2a2f5a] bg-[#0a0c18] transition hover:border-[#5a5aaa]"
                >
                  {poster ? (
                    <img src={tmdbImg(poster, "w185")} alt={title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3a3a7a" strokeWidth="1.5">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </div>
                </button>
                {fav && (
                  <button
                    onClick={() => setFavourite(pos, null)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2a2a5a] text-[#a090ff] transition hover:bg-[#4a2a5a] hover:text-white"
                    title="Remove"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
