import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import MediaCard from "../../components/home/MediaCard.jsx";
import SearchBar from "../../components/home/SearchBar.jsx";
import { useSearch } from "../../features/search/hooks/useSearch.js";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";

function PersonIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
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
    <div className="flex flex-wrap gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="w-[130px] flex-shrink-0 sm:w-[150px]">
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
    <Link
      to={to}
      className="flex w-[130px] flex-shrink-0 flex-col gap-2 sm:w-[150px]"
    >
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

  useEffect(() => {
    setBarValue(qFromUrl);
  }, [qFromUrl]);

  const { results, isLoading, status } = useSearch(q, { showAdult });

  const movieResults = results.filter((r) => r.type === "movie");
  const showResults = results.filter((r) => r.type === "show");
  const personResults = results.filter((r) => r.type === "person");

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
      <div className="mx-auto max-w-[1600px] space-y-10">
        <div className="space-y-6">
          <SearchBar value={barValue} onChange={handleSearchChange} />
          <div>
            <p className="text-sm text-[#8888c8]">Search results for</p>
            <h1 className="mt-1 text-2xl font-extrabold text-white">
              {q ? <>&ldquo;{q}&rdquo;</> : <span className="text-[#4a4a7a]">Enter a search above</span>}
            </h1>
          </div>
        </div>

        {isLoading && !hasResults && (
          <div className="space-y-8">
            <SkeletonGrid />
          </div>
        )}

        {showEmpty && (
          <p className="text-center text-sm text-[#4a4a7a] py-16">
            No results found for &ldquo;{q}&rdquo;
          </p>
        )}

        {hasResults && (
          <div className="space-y-10">
            {movieResults.length > 0 && (
              <section className="space-y-4">
                <SectionHeading>Movies</SectionHeading>
                <div className="flex flex-wrap gap-3">
                  {movieResults.map((item) => (
                    <MediaCard
                      key={`movie-${item.tmdbId}`}
                      id={item.tmdbId}
                      type="movie"
                      title={item.title}
                      posterPath={item.posterPath}
                      isAuthenticated={!!session}
                    />
                  ))}
                </div>
              </section>
            )}

            {showResults.length > 0 && (
              <section className="space-y-4">
                <SectionHeading>Shows</SectionHeading>
                <div className="flex flex-wrap gap-3">
                  {showResults.map((item) => (
                    <MediaCard
                      key={`show-${item.tmdbId}`}
                      id={item.tmdbId}
                      type="show"
                      title={item.title}
                      posterPath={item.posterPath}
                      isAuthenticated={!!session}
                    />
                  ))}
                </div>
              </section>
            )}

            {personResults.length > 0 && (
              <section className="space-y-4">
                <SectionHeading>People</SectionHeading>
                <div className="flex flex-wrap gap-3">
                  {personResults.map((item) => (
                    <PersonCard key={`person-${item.tmdbId}`} person={item} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default SearchPage;
