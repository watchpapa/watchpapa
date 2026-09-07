// Used by:
// - Frontend/src/pages/app/MyServicesPage.jsx
//
// Full browse page for "your services" (Pro+ only — see SettingsPage.jsx),
// scoped everywhere by the user's watchProviders + effectiveWatchRegions
// (usePreferences()). Modeled on the "on my services" half of
// features/home/hooks/useHomeData.js (provider-filtered discover,
// recommendations pagination) — this hook merges movie+show, adds a Top Rated
// row, and adds one "Popular on <service>" row per provider the user picked.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { apiFetch } from "../../../lib/api.js";
import { followBlock } from "../../../lib/followGate.js";
import { listKey, readList, writeList } from "../../../lib/listCache.js";
import { usePreferences } from "../../preferences/PreferencesContext.jsx";
import { useSuggestionSeeds } from "../../home/hooks/useSuggestionSeeds.js";
import { useWatchProviderList } from "../../preferences/hooks/useWatchProviderCatalog.js";
import { isProTier } from "../../../lib/tier.js";

async function fetchDiscover(type, page, { providersKey, region, sort, genreId, includeAdult }) {
  const q = new URLSearchParams({
    page: String(page),
    with_watch_providers: providersKey,
    watch_region: region,
    with_watch_monetization_types: "flatrate|free|ads",
  });
  if (sort) q.set("sort", sort);
  if (genreId) q.set("with_genres", String(genreId));
  if (includeAdult) q.set("include_adult", "true");
  const { results, total_pages } = await apiFetch(`/api/content/discover/${type}?${q}`);
  return { results: results ?? [], totalPages: total_pages ?? 1 };
}

// One row of merged movie+show cards, paginated independently per media kind
// but presented (and "loaded more") as a single row — same merge-by-popularity
// approach useHomeData.js already uses for its "myServices" teaser row.
function useMergedDiscoverRow({ sort, providersKey, region, showAdult, enabled, cacheKey }) {
  const seed = cacheKey ? readList(cacheKey) : undefined;
  const [movieCards, setMovieCards] = useState(() => seed?.movieCards ?? []);
  const [showCards, setShowCards] = useState(() => seed?.showCards ?? []);
  const [moviePage, setMoviePage] = useState(() => seed?.moviePage ?? 1);
  const [showPage, setShowPage] = useState(() => seed?.showPage ?? 1);
  const [movieTotal, setMovieTotal] = useState(() => seed?.movieTotal ?? 1);
  const [showTotal, setShowTotal] = useState(() => seed?.showTotal ?? 1);
  const [count, setCount] = useState(() => seed?.count ?? 20);
  const [loading, setLoading] = useState(!!cacheKey && seed === undefined && enabled);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setMovieCards([]);
      setShowCards([]);
      setMoviePage(1);
      setShowPage(1);
      setMovieTotal(1);
      setShowTotal(1);
      setCount(20);
      return;
    }
    const warm = cacheKey ? readList(cacheKey) : undefined;
    if (warm) {
      setMovieCards(warm.movieCards);
      setShowCards(warm.showCards);
      setMoviePage(warm.moviePage);
      setShowPage(warm.showPage);
      setMovieTotal(warm.movieTotal);
      setShowTotal(warm.showTotal);
      setCount(warm.count);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [mv, sh] = await Promise.all([
          fetchDiscover("movie", 1, { providersKey, region, sort, includeAdult: showAdult }),
          fetchDiscover("tv", 1, { providersKey, region, sort, includeAdult: showAdult }),
        ]);
        if (cancelled) return;
        setMovieCards(mv.results);
        setShowCards(sh.results);
        setMoviePage(1);
        setShowPage(1);
        setMovieTotal(mv.totalPages);
        setShowTotal(sh.totalPages);
        setCount(20);
      } catch {
        if (!cancelled) {
          setMovieCards([]);
          setShowCards([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, providersKey, region, sort, showAdult, cacheKey]);

  useEffect(() => {
    if (!cacheKey || !enabled || loading) return;
    writeList(cacheKey, { movieCards, showCards, moviePage, showPage, movieTotal, showTotal, count });
  }, [cacheKey, enabled, loading, movieCards, showCards, moviePage, showPage, movieTotal, showTotal, count]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const tasks = [];
      if (moviePage < movieTotal) {
        tasks.push(
          fetchDiscover("movie", moviePage + 1, { providersKey, region, sort, includeAdult: showAdult }).then((r) => {
            setMovieCards((p) => [...p, ...r.results]);
            setMoviePage((p) => p + 1);
          }),
        );
      }
      if (showPage < showTotal) {
        tasks.push(
          fetchDiscover("tv", showPage + 1, { providersKey, region, sort, includeAdult: showAdult }).then((r) => {
            setShowCards((p) => [...p, ...r.results]);
            setShowPage((p) => p + 1);
          }),
        );
      }
      await Promise.all(tasks);
      setCount((c) => c + 20);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, moviePage, movieTotal, showPage, showTotal, providersKey, region, sort, showAdult]);

  return {
    movieCards,
    showCards,
    count,
    loading,
    loadingMore,
    loadMore,
    hasMore: count < movieCards.length + showCards.length || moviePage < movieTotal || showPage < showTotal,
  };
}

export function useMyServicesPageData(session, showAdult = false, tier = "free") {
  const { watchProviders, effectiveWatchRegions, localeKey } = usePreferences();
  const region = effectiveWatchRegions[0] ?? null;
  const providersKey = watchProviders.slice().sort((a, b) => a - b).join("|");
  const eligible = isProTier(tier) && !!providersKey && !!region;

  const cacheBase = { uid: session?.user?.id ?? "anon", showAdult, localeKey, providersKey, region: region ?? "" };
  const popularKey = eligible ? listKey("myservices:popular", cacheBase) : null;
  const ratedKey = eligible ? listKey("myservices:rated", cacheBase) : null;
  const providersRowKey = eligible ? listKey("myservices:providerrows", cacheBase) : null;

  const [followedMovieIds, setFollowedMovieIds] = useState(new Set());
  const [followedShowIds, setFollowedShowIds] = useState(new Set());
  const [followLimitError, setFollowLimitError] = useState(null);

  useEffect(() => {
    if (!session?.user?.id) {
      setFollowedMovieIds(new Set());
      setFollowedShowIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const [fm, fs] = await Promise.all([
        supabase.from("user_followed_movies").select("tmdb_id").eq("profile_id", session.user.id),
        supabase.from("user_followed_shows").select("tmdb_id").eq("profile_id", session.user.id),
      ]);
      if (cancelled) return;
      setFollowedMovieIds(new Set((fm.data ?? []).map((r) => Number(r.tmdb_id))));
      setFollowedShowIds(new Set((fs.data ?? []).map((r) => Number(r.tmdb_id))));
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const toggleFollow = useCallback(
    async (type, id) => {
      if (!session?.user?.id || !id) return;
      const table = type === "movie" ? "user_followed_movies" : "user_followed_shows";
      const setter = type === "movie" ? setFollowedMovieIds : setFollowedShowIds;
      const current = type === "movie" ? followedMovieIds : followedShowIds;
      const wasFollowing = current.has(id);
      setter((prev) => {
        const next = new Set(prev);
        wasFollowing ? next.delete(id) : next.add(id);
        return next;
      });
      const { error: writeError } = wasFollowing
        ? await supabase.from(table).delete().eq("profile_id", session.user.id).eq("tmdb_id", id)
        : await supabase.from(table).insert({ profile_id: session.user.id, tmdb_id: id });
      if (writeError) {
        if (writeError.message?.includes("FOLLOW_LIMIT_REACHED")) {
          setFollowLimitError(writeError.message.replace("FOLLOW_LIMIT_REACHED: ", ""));
        }
        setter((prev) => {
          const next = new Set(prev);
          wasFollowing ? next.add(id) : next.delete(id);
          return next;
        });
      }
    },
    [session?.user?.id, followedMovieIds, followedShowIds],
  );

  const toItem = useCallback(
    (c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      posterPath: c.poster_path ?? null,
      genreIds: c.genre_ids ?? [],
      isFollowing: (c.type === "movie" ? followedMovieIds : followedShowIds).has(c.id),
      onFollowToggle: () => toggleFollow(c.type, c.id),
      followBlockedLabel: followBlock(c.type, c),
      nsfw: Boolean(c.nsfw),
    }),
    [followedMovieIds, followedShowIds, toggleFollow],
  );

  const mergeSort = useCallback(
    (movieCards, showCards, count) =>
      [...movieCards.map(toItem), ...showCards.map(toItem)]
        .sort((a, b) => (b.tmdbPopularity ?? 0) - (a.tmdbPopularity ?? 0))
        .slice(0, count),
    [toItem],
  );

  const popular = useMergedDiscoverRow({ providersKey, region, showAdult, enabled: eligible, cacheKey: popularKey });
  const topRated = useMergedDiscoverRow({ sort: "rated", providersKey, region, showAdult, enabled: eligible, cacheKey: ratedKey });

  const popularItems = useMemo(
    () => mergeSort(popular.movieCards, popular.showCards, popular.count),
    [popular.movieCards, popular.showCards, popular.count, mergeSort],
  );
  const topRatedItems = useMemo(
    () => mergeSort(topRated.movieCards, topRated.showCards, topRated.count),
    [topRated.movieCards, topRated.showCards, topRated.count, mergeSort],
  );

  // --- Suggested for you, scoped to services (paginated the same way the
  // home page's suggested rows are — see features/home/hooks/useHomeData.js).
  const { items: seedItems, exclude: seedExclude, loaded: seedsLoaded } = useSuggestionSeeds(session);
  const seedSig = seedsLoaded ? `${seedItems.map((s) => `${s.type}:${s.id}`).join(",")}#${seedExclude.length}` : "pending";
  const sugKey = eligible ? `${listKey("myservices:sug", cacheBase)}::${seedSig}` : null;
  const sugSeed = sugKey ? readList(sugKey) : undefined;

  const [suggestedCards, setSuggestedCards] = useState(() => sugSeed?.suggestedCards ?? []);
  const [suggestedPage, setSuggestedPage] = useState(() => sugSeed?.suggestedPage ?? 1);
  const [hasMoreSuggested, setHasMoreSuggested] = useState(() => sugSeed?.hasMoreSuggested ?? false);
  const [loadingSuggested, setLoadingSuggested] = useState(false);
  const [loadingMoreSuggested, setLoadingMoreSuggested] = useState(false);
  const shownSuggestedIdsRef = useRef(new Set(sugSeed?.shownSuggestedIds ?? []));

  const fetchSuggested = useCallback(
    (page) => {
      const body = {
        items: seedItems,
        exclude: [
          ...seedExclude,
          ...[...shownSuggestedIdsRef.current].map((key) => {
            const [type, rawId] = key.split(":");
            return { type, id: Number(rawId) };
          }),
        ],
        page,
        providers: watchProviders,
        watchRegion: region,
      };
      return apiFetch("/api/content/recommendations", { method: "POST", body: JSON.stringify(body) });
    },
    [seedItems, seedExclude, watchProviders, region],
  );

  useEffect(() => {
    if (!eligible || !seedsLoaded || seedItems.length === 0) {
      setSuggestedCards([]);
      setSuggestedPage(1);
      setHasMoreSuggested(false);
      shownSuggestedIdsRef.current = new Set();
      return;
    }
    const warm = sugKey ? readList(sugKey) : undefined;
    if (warm) {
      setSuggestedCards(warm.suggestedCards);
      setSuggestedPage(warm.suggestedPage);
      setHasMoreSuggested(warm.hasMoreSuggested);
      shownSuggestedIdsRef.current = new Set(warm.shownSuggestedIds ?? []);
      return;
    }
    let cancelled = false;
    shownSuggestedIdsRef.current = new Set();
    (async () => {
      setLoadingSuggested(true);
      try {
        const { resultsOnMyServices } = await fetchSuggested(1);
        if (cancelled) return;
        for (const c of resultsOnMyServices ?? []) shownSuggestedIdsRef.current.add(`${c.type}:${c.id}`);
        setSuggestedCards(resultsOnMyServices ?? []);
        setSuggestedPage(1);
        setHasMoreSuggested((resultsOnMyServices?.length ?? 0) > 0);
      } catch {
        if (!cancelled) {
          setSuggestedCards([]);
          setHasMoreSuggested(false);
        }
      } finally {
        if (!cancelled) setLoadingSuggested(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eligible, seedsLoaded, seedItems, fetchSuggested, sugKey]);

  useEffect(() => {
    if (!sugKey || !seedsLoaded || suggestedCards.length === 0) return;
    writeList(sugKey, {
      suggestedCards,
      suggestedPage,
      hasMoreSuggested,
      shownSuggestedIds: [...shownSuggestedIdsRef.current],
    });
  }, [sugKey, seedsLoaded, suggestedCards, suggestedPage, hasMoreSuggested]);

  const loadMoreSuggested = useCallback(async () => {
    if (loadingMoreSuggested || !hasMoreSuggested) return;
    setLoadingMoreSuggested(true);
    try {
      const nextPage = suggestedPage + 1;
      const { resultsOnMyServices } = await fetchSuggested(nextPage);
      for (const c of resultsOnMyServices ?? []) shownSuggestedIdsRef.current.add(`${c.type}:${c.id}`);
      setSuggestedCards((prev) => [...prev, ...(resultsOnMyServices ?? [])]);
      setSuggestedPage(nextPage);
      setHasMoreSuggested((resultsOnMyServices?.length ?? 0) > 0);
    } catch {
      setHasMoreSuggested(false);
    } finally {
      setLoadingMoreSuggested(false);
    }
  }, [loadingMoreSuggested, hasMoreSuggested, suggestedPage, fetchSuggested]);

  const suggestedItems = useMemo(() => suggestedCards.map(toItem), [suggestedCards, toItem]);

  // --- Per-service rows ("Popular on Netflix", "Popular on Disney+", …) — one
  // row per provider the user has picked, each a merged movie+show discover
  // filtered to just that single provider (same mechanism as the Popular row
  // above, not personalized). Provider ids come from `providersKey` rather
  // than the raw `watchProviders` array so the dependency stays referentially
  // stable (usePreferences() doesn't memoize that array) — same reasoning as
  // `providersKey` itself elsewhere in this file/useHomeData.js.
  const providerIds = useMemo(
    () => (providersKey ? providersKey.split("|").map(Number) : []),
    [providersKey],
  );
  const { providers: providerCatalog } = useWatchProviderList(region);
  const providerNameById = useMemo(() => {
    const map = new Map();
    for (const p of providerCatalog) map.set(p.id, p.name);
    return map;
  }, [providerCatalog]);

  const providerRowsSeed = providersRowKey ? readList(providersRowKey) : undefined;
  const [providerRowState, setProviderRowState] = useState(() => providerRowsSeed?.state ?? {});

  useEffect(() => {
    if (!eligible || providerIds.length === 0) {
      setProviderRowState({});
      return;
    }
    const warm = providersRowKey ? readList(providersRowKey) : undefined;
    if (warm && providerIds.every((pid) => warm.state[pid])) {
      setProviderRowState(warm.state);
      return;
    }
    let cancelled = false;
    (async () => {
      const initial = {};
      for (const pid of providerIds) {
        initial[pid] = { movieCards: [], showCards: [], moviePage: 1, showPage: 1, movieTotal: 1, showTotal: 1, count: 20, loading: true, loadingMore: false };
      }
      setProviderRowState(initial);
      await Promise.all(
        providerIds.map(async (pid) => {
          try {
            const [mv, sh] = await Promise.all([
              fetchDiscover("movie", 1, { providersKey: String(pid), region, includeAdult: showAdult }),
              fetchDiscover("tv", 1, { providersKey: String(pid), region, includeAdult: showAdult }),
            ]);
            if (cancelled) return;
            setProviderRowState((prev) => ({
              ...prev,
              [pid]: {
                movieCards: mv.results,
                showCards: sh.results,
                moviePage: 1,
                showPage: 1,
                movieTotal: mv.totalPages,
                showTotal: sh.totalPages,
                count: 20,
                loading: false,
                loadingMore: false,
              },
            }));
          } catch {
            if (!cancelled) {
              setProviderRowState((prev) => ({
                ...prev,
                [pid]: { movieCards: [], showCards: [], moviePage: 1, showPage: 1, movieTotal: 1, showTotal: 1, count: 20, loading: false, loadingMore: false },
              }));
            }
          }
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [eligible, providerIds, region, showAdult, providersRowKey]);

  // Write-through for the per-service rows (skip while any row is still loading).
  useEffect(() => {
    if (!providersRowKey || providerIds.length === 0) return;
    const rows = providerIds.map((pid) => providerRowState[pid]);
    if (rows.some((r) => !r || r.loading)) return;
    writeList(providersRowKey, { state: providerRowState });
  }, [providersRowKey, providerIds, providerRowState]);

  const loadMoreProviderRow = useCallback(
    async (providerId) => {
      const st = providerRowState[providerId];
      if (!st || st.loadingMore) return;
      setProviderRowState((prev) => ({ ...prev, [providerId]: { ...prev[providerId], loadingMore: true } }));
      try {
        const tasks = [];
        if (st.moviePage < st.movieTotal) {
          tasks.push(
            fetchDiscover("movie", st.moviePage + 1, { providersKey: String(providerId), region, includeAdult: showAdult }).then((r) => ({
              kind: "movie",
              results: r.results,
              totalPages: r.totalPages,
            })),
          );
        }
        if (st.showPage < st.showTotal) {
          tasks.push(
            fetchDiscover("tv", st.showPage + 1, { providersKey: String(providerId), region, includeAdult: showAdult }).then((r) => ({
              kind: "show",
              results: r.results,
              totalPages: r.totalPages,
            })),
          );
        }
        const outcomes = await Promise.all(tasks);
        setProviderRowState((prev) => {
          const cur = prev[providerId];
          let { movieCards, showCards, moviePage, showPage, movieTotal, showTotal } = cur;
          for (const o of outcomes) {
            if (o.kind === "movie") {
              movieCards = [...movieCards, ...o.results];
              moviePage += 1;
              movieTotal = o.totalPages;
            } else {
              showCards = [...showCards, ...o.results];
              showPage += 1;
              showTotal = o.totalPages;
            }
          }
          return {
            ...prev,
            [providerId]: { ...cur, movieCards, showCards, moviePage, showPage, movieTotal, showTotal, count: cur.count + 20, loadingMore: false },
          };
        });
      } catch {
        setProviderRowState((prev) => ({ ...prev, [providerId]: { ...prev[providerId], loadingMore: false } }));
      }
    },
    [providerRowState, region, showAdult],
  );

  const providerRows = useMemo(
    () =>
      providerIds
        .map((pid) => {
          const st = providerRowState[pid];
          if (!st) return null;
          return {
            providerId: pid,
            providerName: providerNameById.get(pid) ?? `Provider ${pid}`,
            items: mergeSort(st.movieCards, st.showCards, st.count),
            hasMore: st.count < st.movieCards.length + st.showCards.length || st.moviePage < st.movieTotal || st.showPage < st.showTotal,
            isLoadingMore: st.loadingMore,
            loading: st.loading,
            onLoadMore: () => loadMoreProviderRow(pid),
          };
        })
        .filter(Boolean),
    [providerIds, providerRowState, providerNameById, mergeSort, loadMoreProviderRow],
  );

  return {
    eligible,
    isLoading: popular.loading,
    popularItems,
    hasMorePopular: popular.hasMore,
    loadMorePopular: popular.loadMore,
    loadingMorePopular: popular.loadingMore,
    topRatedItems,
    hasMoreTopRated: topRated.hasMore,
    loadMoreTopRated: topRated.loadMore,
    loadingMoreTopRated: topRated.loadingMore,
    suggestedItems,
    loadingSuggested,
    hasMoreSuggested,
    loadMoreSuggested,
    loadingMoreSuggested,
    providerRows,
    followLimitError,
    clearFollowLimitError: () => setFollowLimitError(null),
  };
}
