import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase.js";

const TMDB_IMG = "https://image.tmdb.org/t/p/w185";

function SearchModal({ onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const q = query.trim().toLowerCase();

    Promise.all([
      supabase
        .from("movie")
        .select("id, title, poster_path, release_date")
        .ilike("title", `%${q}%`)
        .is("deleted_at", null)
        .order("tmdb_popularity", { ascending: false })
        .limit(6),
      supabase
        .from("show")
        .select("id, name, poster_path, first_air_date")
        .ilike("name", `%${q}%`)
        .is("deleted_at", null)
        .order("tmdb_popularity", { ascending: false })
        .limit(6),
    ]).then(([movies, shows]) => {
      if (cancelled) return;
      setSearching(false);
      const m = (movies.data ?? []).map((r) => ({ ...r, mediaType: "movie", title: r.title, year: r.release_date?.slice(0, 4) }));
      const s = (shows.data ?? []).map((r) => ({ ...r, title: r.name, year: r.first_air_date?.slice(0, 4), mediaType: "show" }));
      setResults([...m, ...s].slice(0, 10));
    });

    return () => { cancelled = true; };
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2f5a] bg-[#0d0f1e] shadow-2xl">
        <div className="border-b border-[#1a1f3a] p-4">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies or shows…"
            className="w-full rounded-xl border border-[#2a3570] bg-[#0a0c18] px-4 py-2.5 text-sm text-white placeholder-[#4a4a7a] outline-none focus:border-[#5a5aaa]"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {searching && <p className="px-3 py-2 text-xs text-[#4a4a7a]">Searching…</p>}
          {!searching && results.length === 0 && query.trim() && (
            <p className="px-3 py-2 text-xs text-[#4a4a7a]">No results</p>
          )}
          {results.map((item) => (
            <button
              key={`${item.mediaType}-${item.id}`}
              onClick={() => onSelect(item)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-[#141728]"
            >
              <div className="h-12 w-8 shrink-0 overflow-hidden rounded border border-[#2a3570] bg-[#0a0c18]">
                {item.poster_path && (
                  <img src={`${TMDB_IMG}${item.poster_path}`} alt={item.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{item.title}</p>
                <p className="text-xs text-[#6868b8]">{item.mediaType === "movie" ? "Movie" : "Show"}{item.year ? ` · ${item.year}` : ""}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="border-t border-[#1a1f3a] p-3">
          <button onClick={onClose} className="text-xs text-[#5050a0] transition hover:text-white">Cancel</button>
        </div>
      </div>
    </div>
  );
}

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
        <SearchModal onSelect={handleSelect} onClose={() => setPickingSlot(null)} />
      )}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#5050b0]">5 Favourites</p>
        <p className="mb-3 text-xs text-[#5050a0]">Mixed movies and shows. Click a slot to change it.</p>
        <div className="grid grid-cols-5 gap-2">
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
                    <img src={`${TMDB_IMG}${poster}`} alt={title} className="h-full w-full object-cover" loading="lazy" />
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
