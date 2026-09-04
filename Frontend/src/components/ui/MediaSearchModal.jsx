import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../lib/api.js";
import { tmdbImg } from "../../lib/tmdbImage.js";

// Debounced movie/show search modal. Used by FavouritesEditor (5-favourites
// picker, movies and shows) and AvatarPicker (poster-as-avatar picker, movies
// only) — anywhere the app needs "search TMDB, pick one title". onSelect
// receives { id, mediaType, title, year, poster_path }.
// `mediaTypes` restricts which result types are kept — default both.
function MediaSearchModal({ onSelect, onClose, title = "Search movies or shows…", mediaTypes = ["movie", "show"] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      apiFetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((d) => {
          if (cancelled) return;
          setSearching(false);
          setResults(
            (d.results ?? [])
              .filter((r) => mediaTypes.includes(r.type))
              .slice(0, 10)
              .map((r) => ({ id: r.tmdbId, mediaType: r.type, title: r.title, year: r.year, poster_path: r.posterPath })),
          );
        })
        .catch(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, mediaTypes]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2f5a] bg-[#0d0f1e] shadow-2xl">
        <div className="border-b border-[#2a3570]/50 p-4">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={title}
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
                  <img src={tmdbImg(item.poster_path, "w185")} alt={item.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{item.title}</p>
                <p className="text-xs text-[#6868b8]">{item.mediaType === "movie" ? "Movie" : "Show"}{item.year ? ` · ${item.year}` : ""}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="border-t border-[#2a3570]/50 p-3">
          <button onClick={onClose} className="text-xs text-[#5050a0] transition hover:text-white">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default MediaSearchModal;
