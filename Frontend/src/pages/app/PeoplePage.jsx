import { useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import SearchBar from "../../components/home/SearchBar.jsx";
import { usePeoplePageData } from "../../features/people/hooks/usePeoplePageData.js";

const TMDB_IMG = "https://image.tmdb.org/t/p/w185";

function fmtDate(val) {
  if (!val) return null;
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function PersonRow({ person, rank }) {
  const born = fmtDate(person.birthday);

  const details = [
    born && ["Born", born],
    person.place_of_birth && ["From", person.place_of_birth],
  ].filter(Boolean);

  return (
    <Link
      to={`/people/${person.id}`}
      className="flex items-start gap-3 rounded-2xl border border-[#1a1f3a] bg-[#0d0f1e] p-3 transition hover:border-[#3a3a7a] hover:bg-[#141728] sm:gap-5 sm:p-4"
    >
      <span className="mt-1 hidden w-8 flex-shrink-0 text-right text-sm font-bold text-[#3a3a7a] sm:block">
        {rank}
      </span>

      <div className="h-32 w-[86px] flex-shrink-0 overflow-hidden rounded-xl border border-[#2a3570] bg-[#12163a]">
        {person.profile_path ? (
          <img
            src={`${TMDB_IMG}${person.profile_path}`}
            alt={person.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 pt-1">
        <p className="text-base font-extrabold text-white leading-tight">{person.name}</p>
        {details.length > 0 && (
          <ul className="mt-2 space-y-1">
            {details.map(([label, value]) => (
              <li key={label} className="flex gap-2 text-xs">
                <span className="w-8 flex-shrink-0 font-semibold text-[#8383e7]">{label}</span>
                <span className="text-[#c0c0e8]">{value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <svg className="mt-1 hidden flex-shrink-0 text-[#3a3a7a] sm:block" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-2xl border border-[#1a1f3a] bg-[#0d0f1e] p-3 sm:gap-5 sm:p-4">
          <div className="mt-1 hidden h-4 w-8 animate-pulse rounded bg-[#1e2240] sm:block" />
          <div className="h-32 w-[86px] flex-shrink-0 animate-pulse rounded-xl bg-[#1e2240]" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-5 w-44 animate-pulse rounded bg-[#1e2240]" />
            <div className="h-3 w-32 animate-pulse rounded bg-[#1e2240]" />
            <div className="h-3 w-48 animate-pulse rounded bg-[#1e2240]" />
          </div>
        </div>
      ))}
    </>
  );
}

function PeoplePage({ session, showAdult }) {
  const [search, setSearch] = useState("");
  const { people, isLoading, isLoadingMore, hasMore, loadMore, error } = usePeoplePageData(showAdult);

  return (
    <AppLayout session={session}>
      <div className="mx-auto max-w-3xl">
        <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} />
        <h2 className="mt-8 mb-6 text-xl font-extrabold tracking-tight" style={{ color: "#e8c04a" }}>
          Popular People
        </h2>

        {error && (
          <p className="text-center text-sm text-red-400 mb-4">Failed to load people: {error}</p>
        )}

        <div className="space-y-2">
          {isLoading ? (
            <SkeletonRows />
          ) : (
            <>
              {people.map((person, i) => (
                <PersonRow key={person.id} person={person} rank={i + 1} />
              ))}
              {isLoadingMore && <SkeletonRows />}
            </>
          )}
        </div>

        {!isLoading && hasMore && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-6 py-2.5 text-sm font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white disabled:opacity-50"
            >
              {isLoadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default PeoplePage;
