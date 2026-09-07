import { useCallback, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import MediaGrid from "../../components/home/MediaGrid.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import PillTabs from "../../components/ui/PillTabs.jsx";
import Select from "../../components/ui/Select.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import { SkeletonPosterGrid } from "../../components/ui/Skeleton.jsx";
import { useAdultPageData } from "../../features/adult/hooks/useAdultPageData.js";
import { useContent } from "../../features/content/hooks/useContent.js";
import { usePreferences } from "../../features/preferences/PreferencesContext.jsx";
import { AlertIcon } from "../../components/icons/index.jsx";

const CONFIRM_KEY = "wp:adultPageConfirmed";

function readConfirmed() {
  try {
    return sessionStorage.getItem(CONFIRM_KEY) === "1";
  } catch {
    return false;
  }
}

const TYPES = [
  { value: "movie", label: "Movies" },
  { value: "show", label: "Shows" },
];

const SORTS = [
  { value: "popular", label: "Most popular" },
  { value: "rated", label: "Highest rated" },
  { value: "newest", label: "Newest" },
];

// URL-param defaults — a param at its default is dropped to keep /adult clean.
const PARAM_DEFAULTS = { type: "movie", sort: "popular", cat: "" };

// Category select value encoding: "" = all, "k:<ids>" = NSFW keyword category,
// "g:<id>" = genre (within adult titles).
function parseCategory(value) {
  if (value.startsWith("k:")) return { keyword: value.slice(2), genreId: null };
  if (value.startsWith("g:")) return { keyword: null, genreId: Number(value.slice(2)) };
  return { keyword: null, genreId: null };
}

// One-time-per-tab interstitial: the two Settings switches already mean the
// user opted in, but landing here still gets an explicit heads-up before any
// poster renders. Posters here are deliberately NOT blurred — this is the gate.
function Warning({ onConfirm }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center sm:py-24">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 text-red-400">
        <AlertIcon size={26} />
      </span>
      <Badge variant="danger" size="md">18+ content</Badge>
      <h1 className="text-2xl font-extrabold text-white">You're about to view adult content</h1>
      <p className="text-sm text-text-muted">
        This page lists movies and shows flagged as adult/erotica — unblurred, unlike everywhere else in the app. It's only reachable because you turned on the Adult tab in Settings.
      </p>
      <div className="mt-2 grid w-full grid-cols-1 gap-2 xs:grid-cols-2">
        <Button to="/" variant="secondary" size="lg">Take me back</Button>
        <Button onClick={onConfirm} size="lg" className="border-red-500 from-red-500 to-red-700 shadow-[0_4px_14px_-6px_rgba(220,38,38,0.8)] hover:from-red-400 hover:to-red-600">
          I understand, continue
        </Button>
      </div>
    </div>
  );
}

function AdultPage({ session, showAdult }) {
  const { showAdultTab } = usePreferences();
  const [confirmed, setConfirmed] = useState(readConfirmed);

  // type / sort / category live in the URL so Back restores them (paired with
  // the grid-data cache in useAdultPageData). `cat` encodes all|keyword|genre.
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get("type") ?? PARAM_DEFAULTS.type;
  const sort = searchParams.get("sort") ?? PARAM_DEFAULTS.sort;
  const category = searchParams.get("cat") ?? PARAM_DEFAULTS.cat;

  const setParams = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v == null || v === "" || v === PARAM_DEFAULTS[k]) p.delete(k);
            else p.set(k, v);
          }
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const setSort = useCallback((v) => setParams({ sort: v }), [setParams]);
  const setCategory = useCallback((v) => setParams({ cat: v }), [setParams]);

  const allowed = showAdult && showAdultTab;
  const enabled = allowed && confirmed;

  const { data: catData } = useContent(enabled ? "/api/content/adult/categories" : null);
  const { data: genreData } = useContent(enabled ? "/api/content/genres" : null);
  const categories = catData?.categories ?? [];
  const genres = (type === "movie" ? genreData?.movie : genreData?.tv) ?? [];

  const { items, isLoading, error, hasMore, loadMore, loadingMore } = useAdultPageData(session, enabled, { type, sort, ...parseCategory(category) });

  // Self-guard: a direct/bookmarked URL visit skips the Navbar's check.
  if (!allowed) return <Navigate to="/" replace />;

  function confirm() {
    setConfirmed(true);
    try { sessionStorage.setItem(CONFIRM_KEY, "1"); } catch { /* re-warn next visit */ }
  }

  function changeType(next) {
    // genre ids differ between movie/tv → drop a genre category on the switch
    setParams({ type: next, ...(category.startsWith("g:") ? { cat: "" } : {}) });
  }

  const activeLabel = category.startsWith("k:")
    ? categories.find((c) => `k:${c.ids}` === category)?.label
    : category.startsWith("g:")
      ? genres.find((g) => `g:${g.id}` === category)?.name
      : null;

  const categoryOptions = [
    { value: "", label: "All categories" },
    ...categories.map((c) => ({ value: `k:${c.ids}`, label: `Type · ${c.label}` })),
    ...genres.map((g) => ({ value: `g:${g.id}`, label: `Genre · ${g.name}` })),
  ];

  return (
    <AppLayout session={session}>
      <PageHead title="Adult" path="/adult" noindex />
      {!confirmed ? (
        <Warning onConfirm={confirm} />
      ) : (
        <PageContainer width="wide" className="space-y-6">
          <PageHeader
            title="Adult"
            badge={<Badge variant="danger" size="xs" className="ml-2">18+</Badge>}
            subtitle="Titles flagged as adult or erotica. Shown unblurred — you opted in via Settings."
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <PillTabs aria-label="Type" tabs={TYPES} value={type} onChange={changeType} className="w-fit" />
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Select value={category} onChange={setCategory} options={categoryOptions} aria-label="Category" full />
                <Select value={sort} onChange={setSort} options={SORTS} aria-label="Sort by" full />
              </div>
            </div>
          </PageHeader>

          {error && <ErrorNote>Failed to load content: {error}</ErrorNote>}

          {isLoading ? (
            <SkeletonPosterGrid count={14} />
          ) : items.length === 0 ? (
            <EmptyState title={`Nothing here${activeLabel ? ` for ${activeLabel}` : ""}`} description="Try another category or sort." />
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
        </PageContainer>
      )}
    </AppLayout>
  );
}

export default AdultPage;
