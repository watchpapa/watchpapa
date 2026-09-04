import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import MediaCard from "../../components/home/MediaCard.jsx";
import SearchBar from "../../components/home/SearchBar.jsx";
import { useSearch } from "../../features/search/hooks/useSearch.js";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { followBlock } from "../../lib/followGate.js";

function PersonIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const TYPE_TABS = [
  { key: "all", label: "All" },
  { key: "movie", label: "Movies" },
  { key: "show", label: "Shows" },
  { key: "person", label: "People" },
];

const SORTS = [
  { key: "relevance", label: "Most relevant" },
  { key: "popularity", label: "Popularity" },
  { key: "rating", label: "Highest rated" },
  { key: "newest", label: "Newest" },
  { key: "title", label: "Title A-Z" },
];

function sortResults(results, sort) {
  if (sort === "relevance") return results;
  const arr = [...results];
  if (sort === "popularity") {
    arr.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  } else if (sort === "rating") {
    arr.sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0));
  } else if (sort === "newest") {
    arr.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  } else if (sort === "title") {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  }
  return arr;
}

function SectionHeading({ children }) {
  return (
    <h2 className="flex items-center text-xl font-extrabold tracking-tight text-white">
      <span className="mr-2.5 h-5 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#c084fc] to-[#6f6fdc]" aria-hidden />
      {children}
    </h2>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] animate-pulse rounded-2xl bg-[#1e2240]" />
          <div className="mt-2 h-3 animate-pulse rounded bg-[#1e2240]" />
          <div className="mt-1.5 mx-auto h-5 w-16 animate-pulse rounded-full bg-[#1e2240]" />
        </div>
      ))}
    </div>
  );
}

function PersonCard({ person }) {
  const to = `/people/${person.tmdbId}`;
  return (
    <Link to={to} className="flex flex-col gap-2">
      <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-[#2a3570] bg-[#12163a]">
        {person.posterPath ? (
          <img
            src={tmdbImg(person.posterPath, "w185")}
            alt={person.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PersonIcon />
          </div>
        )}
      </div>
      <p className="text-center text-xs font-semibold leading-tight text-white line-clamp-2 min-h-[2.5em]">
        {person.title}
      </p>
      <span className="mx-auto rounded-full border border-[#3a3a7a] bg-[#1a1d35] px-3 py-0.5 text-[11px] font-bold text-[#8888c8]">
        Person
      </span>
    </Link>
  );
}

function SearchPage({ session, showAdult }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const q = qFromUrl.trim();
  const [barValue, setBarValue] = useState(qFromUrl);
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("relevance");

  useEffect(() => {
    setBarValue(qFromUrl);
  }, [qFromUrl]);

  // Reset filter/sort whenever the query itself changes, so an old filter
  // from a previous search doesn't silently hide everything for a new one.
  useEffect(() => {
    setTypeFilter("all");
    setSort("relevance");
  }, [q]);

  const { results, isLoading, isLoadingMore, status, hasMore, loadMore } = useSearch(q, { showAdult });

  const counts = useMemo(
    () => ({
      all: results.length,
      movie: results.filter((r) => r.type === "movie").length,
      show: results.filter((r) => r.type === "show").length,
      person: results.filter((r) => r.type === "person").length,
    }),
    [results],
  );

  // Movies + shows share one relevance/sorted grid; people get their own
  // section below it (a person card and a poster card don't mix well in one
  // grid, and "sort by rating/newest" means nothing for a person).
  const { mediaVisible, peopleVisible } = useMemo(() => {
    const filtered = typeFilter === "all" ? results : results.filter((r) => r.type === typeFilter);
    return {
      mediaVisible: sortResults(filtered.filter((r) => r.type !== "person"), sort),
      peopleVisible: filtered.filter((r) => r.type === "person"),
    };
  }, [results, typeFilter, sort]);

  const hasResults = results.length > 0;
  const showEmpty = status !== "loading" && status !== "idle" && !hasResults;

  function handleSearchChange(e) {
    const v = e.target.value;
    setBarValue(v);
    const next = new URLSearchParams(searchParams);
    if (v) next.set("q", v);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  }

  return (
    <AppLayout session={session}>
      <PageHead
        title={q ? `"${q}"` : "Search"}
        description={q ? `Search results for "${q}" on watchpapa — discover films, shows, and people.` : "Search films, shows, and people on watchpapa."}
        path={q ? `/search?q=${encodeURIComponent(q)}` : "/search"}
        noindex={!!q}
      />
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="space-y-6">
          {/* On this page the full results grid is right below, so the
              typeahead dropdown would just duplicate it — suppressed here. */}
          <SearchBar value={barValue} onChange={handleSearchChange} showDropdown={false} />
          <div>
            <p className="text-sm text-[#8888c8]">Search results for</p>
            <h1 className="mt-1 text-2xl font-extrabold text-white">
              {q ? <>&ldquo;{q}&rdquo;</> : <span className="text-[#4a4a7a]">Enter a search above</span>}
            </h1>
          </div>
        </div>

        {hasResults && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-xl border border-[#2a3570]/50 bg-[#0a0c18] p-1">
              {TYPE_TABS.filter((t) => t.key === "all" || counts[t.key] > 0).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTypeFilter(key)}
                  className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                    typeFilter === key
                      ? "bg-gradient-to-b from-[#6f6fdc] to-[#4b3bb0] text-white shadow-[0_4px_14px_-6px_rgba(111,111,220,0.8)]"
                      : "text-[#8888c8] hover:text-white"
                  }`}
                >
                  {label} <span className="text-xs opacity-70">({counts[key]})</span>
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-[#8888c8]">
              Sort by
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-lg border border-[#2a3570] bg-[#141728] px-3 py-2 text-sm text-white outline-none transition focus:border-[#6f6fdc]"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {isLoading && !hasResults && <SkeletonGrid />}

        {showEmpty && (
          <p className="text-center text-sm text-[#4a4a7a] py-16">
            No results found for &ldquo;{q}&rdquo;
          </p>
        )}

        {hasResults && (
          <>
            {mediaVisible.length > 0 && (
              <section className="space-y-4">
                {typeFilter === "all" && peopleVisible.length > 0 && <SectionHeading>Movies &amp; Shows</SectionHeading>}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
                  {mediaVisible.map((item) => (
                    <MediaCard
                      key={`${item.type}-${item.tmdbId}`}
                      id={item.tmdbId}
                      type={item.type}
                      title={item.title}
                      posterPath={item.posterPath}
                      isAuthenticated={!!session}
                      nsfw={item.nsfw}
                      // Movies gate on `date`; shows on `status`, which the
                      // Worker backfills onto search rows (see publicContent.js).
                      followBlockedLabel={followBlock(item.type, item)}
                    />
                  ))}
                </div>
              </section>
            )}

            {peopleVisible.length > 0 && (
              <section className="space-y-4">
                {typeFilter === "all" && <SectionHeading>People</SectionHeading>}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
                  {peopleVisible.map((item) => (
                    <PersonCard key={`person-${item.tmdbId}`} person={item} />
                  ))}
                </div>
              </section>
            )}

            {mediaVisible.length === 0 && peopleVisible.length === 0 && (
              <p className="py-16 text-center text-sm text-[#4a4a7a]">Nothing in this category — try another filter or load more.</p>
            )}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="flex items-center gap-2 rounded-full border border-[#2a3570] bg-[#141728] px-6 py-2 text-sm font-semibold text-[#8888c8] transition hover:border-[#5050a0] hover:text-white disabled:opacity-60"
                >
                  {isLoadingMore ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#8888c8] border-t-transparent" aria-hidden />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default SearchPage;
