import { useState } from "react";
import { Navigate } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import MediaGrid from "../../components/home/MediaGrid.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useAdultPageData } from "../../features/adult/hooks/useAdultPageData.js";
import { useContent } from "../../features/content/hooks/useContent.js";
import { usePreferences } from "../../features/preferences/PreferencesContext.jsx";

const CONFIRM_KEY = "wp:adultPageConfirmed";

function readConfirmed() {
  try {
    return sessionStorage.getItem(CONFIRM_KEY) === "1";
  } catch {
    return false;
  }
}

const TYPES = [
  { key: "movie", label: "Movies" },
  { key: "show", label: "Shows" },
];

const SORTS = [
  { key: "popular", label: "Most popular" },
  { key: "rated", label: "Highest rated" },
  { key: "newest", label: "Newest" },
];

// Category select value encoding: "" = all, "k:<ids>" = NSFW keyword category,
// "g:<id>" = genre (within adult titles).
function parseCategory(value) {
  if (value.startsWith("k:")) return { keyword: value.slice(2), genreId: null };
  if (value.startsWith("g:")) return { keyword: null, genreId: Number(value.slice(2)) };
  return { keyword: null, genreId: null };
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] animate-pulse rounded-2xl bg-[#1e2240]" />
          <div className="mt-2 h-3 animate-pulse rounded bg-[#1e2240]" />
        </div>
      ))}
    </div>
  );
}

// One-time-per-tab interstitial — the two Settings switches already mean the
// user opted in, but landing here (Navbar link or a bookmarked/typed URL) still
// gets an explicit heads-up before any poster renders, same spirit as the
// age-gate on signup. Posters here are deliberately NOT blurred — this is the
// gate instead.
function Warning({ onConfirm }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-400">
        18+ Content
      </span>
      <h1 className="text-2xl font-extrabold text-white">You're about to view adult content</h1>
      <p className="text-sm text-[#8888c8]">
        This page lists movies and shows flagged as adult/erotica — unblurred, unlike everywhere
        else in the app. It's only reachable because you turned on the Adult tab in Settings.
      </p>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl border border-red-500 bg-gradient-to-b from-red-500 to-red-700 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(220,38,38,0.8)] transition hover:from-red-400 hover:to-red-600"
        >
          I understand, continue
        </button>
        <a
          href="/"
          className="rounded-xl border border-[#2a3570] px-5 py-2.5 text-sm font-semibold text-[#8888c8] transition hover:text-white"
        >
          Take me back
        </a>
      </div>
    </div>
  );
}

const selectClass =
  "rounded-lg border border-[#2a3570] bg-[#141728] px-3 py-2 text-sm text-white outline-none transition focus:border-[#6f6fdc]";

function AdultPage({ session, showAdult }) {
  const { showAdultTab } = usePreferences();
  const [confirmed, setConfirmed] = useState(readConfirmed);
  const [type, setType] = useState("movie");
  const [sort, setSort] = useState("popular");
  const [category, setCategory] = useState("");

  const allowed = showAdult && showAdultTab;
  const enabled = allowed && confirmed;

  const { data: catData } = useContent(enabled ? "/api/content/adult/categories" : null);
  const { data: genreData } = useContent(enabled ? "/api/content/genres" : null);
  const categories = catData?.categories ?? [];
  const genres = (type === "movie" ? genreData?.movie : genreData?.tv) ?? [];

  const { items, isLoading, error, hasMore, loadMore, loadingMore } = useAdultPageData(session, enabled, {
    type,
    sort,
    ...parseCategory(category),
  });

  // Self-guard: the Navbar link is only ever rendered when both switches are
  // on, but a direct/bookmarked URL visit skips that check entirely.
  if (!allowed) return <Navigate to="/" replace />;

  function confirm() {
    setConfirmed(true);
    try {
      sessionStorage.setItem(CONFIRM_KEY, "1");
    } catch {
      /* private-mode browsers: just re-warn next visit this session */
    }
  }

  function changeType(next) {
    setType(next);
    // Genre ids differ between movie/tv — a genre pick doesn't carry over.
    if (category.startsWith("g:")) setCategory("");
  }

  const activeLabel =
    category.startsWith("k:")
      ? categories.find((c) => `k:${c.ids}` === category)?.label
      : category.startsWith("g:")
        ? genres.find((g) => `g:${g.id}` === category)?.name
        : null;

  return (
    <AppLayout session={session}>
      <PageHead title="Adult" path="/adult" noindex />
      {!confirmed ? (
        <Warning onConfirm={confirm} />
      ) : (
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="flex items-center text-xl font-bold text-white">
              <span className="mr-2.5 h-5 w-1 shrink-0 rounded-full bg-gradient-to-b from-red-500 to-red-800" aria-hidden />
              Adult
              <span className="ml-2.5 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-400">
                18+
              </span>
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-xl border border-[#2a3570]/50 bg-[#0a0c18] p-1">
                {TYPES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeType(key)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                      type === key
                        ? "bg-gradient-to-b from-red-500 to-red-800 text-white shadow-[0_4px_14px_-6px_rgba(220,38,38,0.8)]"
                        : "text-[#8888c8] hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass} aria-label="Category">
                <option value="">All categories</option>
                {categories.length > 0 && (
                  <optgroup label="Type">
                    {categories.map((c) => (
                      <option key={c.key} value={`k:${c.ids}`}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {genres.length > 0 && (
                  <optgroup label="Genre">
                    {genres.map((g) => (
                      <option key={g.id} value={`g:${g.id}`}>
                        {g.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass} aria-label="Sort by">
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-center text-sm text-red-400">Failed to load content: {error}</p>}

          {isLoading ? (
            <SkeletonGrid />
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#4a4a7a]">
              Nothing here{activeLabel ? ` for ${activeLabel}` : ""} — try another category or sort.
            </p>
          ) : (
            <MediaGrid
              title={`${type === "movie" ? "Movies" : "Shows"}${activeLabel ? ` · ${activeLabel}` : ""}`}
              items={items}
              session={session}
              hasMore={hasMore}
              onLoadMore={loadMore}
              isLoadingMore={loadingMore}
            />
          )}
        </div>
      )}
    </AppLayout>
  );
}

export default AdultPage;
