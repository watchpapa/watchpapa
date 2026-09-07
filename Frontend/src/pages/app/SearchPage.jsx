import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSearchParamState } from "../../hooks/index.js";
import AppLayout from "../../layouts/AppLayout.jsx";
import MediaCard from "../../components/home/MediaCard.jsx";
import PosterGrid from "../../components/home/PosterGrid.jsx";
import SearchBar from "../../components/home/SearchBar.jsx";
import { useSearch } from "../../features/search/hooks/useSearch.js";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import PillTabs from "../../components/ui/PillTabs.jsx";
import Select from "../../components/ui/Select.jsx";
import SectionTitle from "../../components/ui/SectionTitle.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import LoadMoreButton from "../../components/ui/LoadMoreButton.jsx";
import { SkeletonPosterGrid } from "../../components/ui/Skeleton.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { followBlock } from "../../lib/followGate.js";
import { SearchIcon, UserIcon } from "../../components/icons/index.jsx";

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
  if (sort === "popularity") arr.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  else if (sort === "rating") arr.sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0));
  else if (sort === "newest") {
    arr.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  } else if (sort === "title") arr.sort((a, b) => a.title.localeCompare(b.title));
  return arr;
}

function PersonCard({ person }) {
  return (
    <Link to={`/people/${person.tmdbId}`} className="group flex flex-col gap-2">
      <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-surface-4 transition group-hover:border-brand">
        {person.posterPath ? (
          <img src={tmdbImg(person.posterPath, "w185")} alt={person.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-border-strong"><UserIcon size={32} /></div>
        )}
      </div>
      <p className="line-clamp-2 min-h-[2.5em] text-center text-xs font-semibold leading-tight text-white">{person.title}</p>
      <span className="mx-auto rounded-full border border-border-strong bg-surface-3 px-3 py-0.5 text-[11px] font-bold text-text-muted">Person</span>
    </Link>
  );
}

function SearchPage({ session, showAdult }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const q = qFromUrl.trim();
  const [barValue, setBarValue] = useState(qFromUrl);

  // Keep the bar in sync with the URL query (state adjusted during render — no
  // effects). Type filter + sort are URL-backed so Back restores them; they now
  // persist across query edits rather than resetting to defaults.
  const [seenUrlQ, setSeenUrlQ] = useState(qFromUrl);
  if (seenUrlQ !== qFromUrl) {
    setSeenUrlQ(qFromUrl);
    setBarValue(qFromUrl);
  }
  const [typeFilter, setTypeFilter] = useSearchParamState("type", "all");
  const [sort, setSort] = useSearchParamState("sort", "relevance");

  const { results, isLoading, isLoadingMore, status, hasMore, loadMore } = useSearch(q, { showAdult, cache: true });

  const counts = useMemo(
    () => ({
      all: results.length,
      movie: results.filter((r) => r.type === "movie").length,
      show: results.filter((r) => r.type === "show").length,
      person: results.filter((r) => r.type === "person").length,
    }),
    [results],
  );

  // Movies + shows share one sorted grid; people get their own section (a
  // person card and a poster card don't mix, and rating/date sorts mean
  // nothing for a person).
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
      <PageContainer width="wide" className="space-y-6">
        <PageHeader
          eyebrow={q ? "Search results for" : undefined}
          title={q ? <>&ldquo;{q}&rdquo;</> : "Search"}
          subtitle={q ? undefined : "Films, shows and people — start typing."}
        >
          {/* Typeahead dropdown suppressed: the full grid is right below. */}
          <SearchBar value={barValue} onChange={handleSearchChange} showDropdown={false} maxWidthClass="max-w-[640px]" autoFocus={!q} />
        </PageHeader>

        {hasResults && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <PillTabs
              aria-label="Result type"
              tabs={TYPE_TABS.filter((t) => t.key === "all" || counts[t.key] > 0).map((t) => ({ value: t.key, label: t.label, count: counts[t.key] }))}
              value={typeFilter}
              onChange={setTypeFilter}
              className="w-fit max-w-full"
            />
            <label className="flex items-center gap-2 text-sm text-text-muted sm:shrink-0">
              <span className="shrink-0">Sort by</span>
              <Select value={sort} onChange={setSort} options={SORTS.map((s) => ({ value: s.key, label: s.label }))} className="min-w-0 flex-1 sm:w-48 sm:flex-none" />
            </label>
          </div>
        )}

        {isLoading && !hasResults && <SkeletonPosterGrid />}

        {!q && !isLoading && (
          <EmptyState icon={SearchIcon} title="Search watchpapa" description="Try a title, a person, or a franchise — results include movies, shows and people." />
        )}

        {showEmpty && q && (
          <EmptyState icon={SearchIcon} title={<>No results for &ldquo;{q}&rdquo;</>} description="Check the spelling or try a shorter query." />
        )}

        {hasResults && (
          <>
            {mediaVisible.length > 0 && (
              <section className="space-y-3">
                {typeFilter === "all" && peopleVisible.length > 0 && <SectionTitle size="lg">Movies &amp; Shows</SectionTitle>}
                <PosterGrid>
                  {mediaVisible.map((item) => (
                    <MediaCard
                      key={`${item.type}-${item.tmdbId}`}
                      id={item.tmdbId}
                      type={item.type}
                      title={item.title}
                      posterPath={item.posterPath}
                      isAuthenticated={!!session}
                      nsfw={item.nsfw}
                      followBlockedLabel={followBlock(item.type, item)}
                    />
                  ))}
                </PosterGrid>
              </section>
            )}

            {peopleVisible.length > 0 && (
              <section className="space-y-3">
                {typeFilter === "all" && <SectionTitle size="lg">People</SectionTitle>}
                <PosterGrid>
                  {peopleVisible.map((item) => <PersonCard key={`person-${item.tmdbId}`} person={item} />)}
                </PosterGrid>
              </section>
            )}

            {mediaVisible.length === 0 && peopleVisible.length === 0 && (
              <EmptyState compact title="Nothing in this category" description="Try another filter or load more results." />
            )}

            <LoadMoreButton onClick={loadMore} loading={isLoadingMore} hasMore={hasMore} label="Load more results" />
          </>
        )}
      </PageContainer>
    </AppLayout>
  );
}

export default SearchPage;
