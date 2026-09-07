// Shared engine for the /movies and /shows browse pages. Popular list + a
// "coming soon" row + one row per genre, all live from the Worker (TMDB
// popular / discover). Follow state stays in Supabase, keyed by tmdb_id.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { apiFetch } from "../../../lib/api.js";
import { followBlock } from "../../../lib/followGate.js";
import { listKey, readList, writeList } from "../../../lib/listCache.js";
import { usePreferences } from "../../preferences/PreferencesContext.jsx";

function formatReleaseLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const KIND = {
  movie: {
    type: "movie",
    listKind: "movies-popular",
    discover: "movie",
    followTable: "user_followed_movies",
    genresKey: "movie",
  },
  show: {
    type: "show",
    listKind: "shows-popular",
    discover: "tv",
    followTable: "user_followed_shows",
    genresKey: "tv",
  },
};

async function fetchPage(path, includeAdult) {
  const sep = path.includes("?") ? "&" : "?";
  const { results, total_pages } = await apiFetch(
    `${path}${includeAdult ? `${sep}include_adult=true` : ""}`,
  );
  return { results: results ?? [], totalPages: total_pages ?? 1 };
}

export function useMediaBrowse(mediaKind, session, showAdult = false) {
  const K = KIND[mediaKind];
  const { watchProviders, effectiveWatchRegions, localeKey } = usePreferences();
  const myServicesRegion = effectiveWatchRegions[0] ?? null;
  const providersKey = watchProviders.slice().sort((a, b) => a - b).join("|");

  // Snapshot key — Back restores the whole page from this instead of refetching.
  const key = listKey(`browse:${mediaKind}`, {
    uid: session?.user?.id ?? "anon",
    showAdult,
    localeKey,
    providersKey,
    region: myServicesRegion ?? "",
  });
  const seed = readList(key);

  const [popularCards, setPopularCards] = useState(() => seed?.popularCards ?? []);
  const [comingSoon, setComingSoon] = useState(() => seed?.comingSoon ?? []);
  const [genres, setGenres] = useState(() => seed?.genres ?? []);
  const [genreRows, setGenreRows] = useState(() => seed?.genreRows ?? {}); // id -> { name, cards, page, totalPages }
  const [followedIds, setFollowedIds] = useState(() => seed?.followedIds ?? new Set());
  const [isLoading, setIsLoading] = useState(seed === undefined);
  const [error, setError] = useState(null);
  const [followLimitError, setFollowLimitError] = useState(null);

  const [popPage, setPopPage] = useState(() => seed?.popPage ?? 1);
  const [popTotal, setPopTotal] = useState(() => seed?.popTotal ?? 1);
  const [loadingMorePopular, setLoadingMorePopular] = useState(false);
  const [loadingGenreId, setLoadingGenreId] = useState(null);

  const [myServicesCards, setMyServicesCards] = useState(() => seed?.myServicesCards ?? []);
  const [myServicesPage, setMyServicesPage] = useState(() => seed?.myServicesPage ?? 1);
  const [myServicesTotal, setMyServicesTotal] = useState(() => seed?.myServicesTotal ?? 1);
  const [loadingMyServices, setLoadingMyServices] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Warm cache (Back nav): restore everything, refresh only follow state.
    const warm = readList(key);
    if (warm) {
      setPopularCards(warm.popularCards);
      setComingSoon(warm.comingSoon);
      setGenres(warm.genres);
      setGenreRows(warm.genreRows);
      setPopPage(warm.popPage);
      setPopTotal(warm.popTotal);
      setMyServicesCards(warm.myServicesCards);
      setMyServicesPage(warm.myServicesPage);
      setMyServicesTotal(warm.myServicesTotal);
      setFollowedIds(warm.followedIds);
      setIsLoading(false);
      if (session?.user?.id) {
        supabase
          .from(K.followTable)
          .select("tmdb_id")
          .eq("profile_id", session.user.id)
          .then(({ data }) => {
            if (!cancelled && data) setFollowedIds(new Set(data.map((r) => Number(r.tmdb_id))));
          });
      }
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      setIsLoading(true);
      try {
        const [pop, upcoming, genreList] = await Promise.all([
          fetchPage(`/api/content/list/${K.listKind}?page=1`, showAdult),
          fetchPage(`/api/content/discover/${K.discover}?upcoming=1`, showAdult),
          apiFetch("/api/content/genres"),
        ]);
        if (cancelled) return;
        setPopularCards(pop.results);
        setPopPage(1);
        setPopTotal(pop.totalPages);
        setComingSoon(upcoming.results);
        setGenres(genreList[K.genresKey] ?? []);
        setGenreRows({});

        if (session?.user?.id) {
          const { data } = await supabase
            .from(K.followTable)
            .select("tmdb_id")
            .eq("profile_id", session.user.id);
          if (!cancelled) setFollowedIds(new Set((data ?? []).map((r) => Number(r.tmdb_id))));
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `key` folds in mediaKind, uid, showAdult, localeKey, providers, region.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (readList(key)) return undefined; // warm — the main effect restored this row
    if (!providersKey || !myServicesRegion) {
      setMyServicesCards([]);
      setMyServicesPage(1);
      setMyServicesTotal(1);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingMyServices(true);
      try {
        const path = `/api/content/discover/${K.discover}?with_watch_providers=${providersKey}&watch_region=${myServicesRegion}&with_watch_monetization_types=flatrate|free|ads&page=1`;
        const { results, totalPages } = await fetchPage(path, showAdult);
        if (cancelled) return;
        setMyServicesCards(results);
        setMyServicesPage(1);
        setMyServicesTotal(totalPages);
      } catch {
        if (!cancelled) setMyServicesCards([]);
      } finally {
        if (!cancelled) setLoadingMyServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadMoreMyServices = useCallback(async () => {
    if (loadingMyServices || myServicesPage >= myServicesTotal || !myServicesRegion) return;
    setLoadingMyServices(true);
    try {
      const path = `/api/content/discover/${K.discover}?with_watch_providers=${providersKey}&watch_region=${myServicesRegion}&with_watch_monetization_types=flatrate|free|ads&page=${myServicesPage + 1}`;
      const { results } = await fetchPage(path, showAdult);
      setMyServicesCards((prev) => [...prev, ...results]);
      setMyServicesPage((p) => p + 1);
    } finally {
      setLoadingMyServices(false);
    }
  }, [loadingMyServices, myServicesPage, myServicesTotal, myServicesRegion, K.discover, providersKey, showAdult]);

  const toggleFollow = useCallback(
    async (id) => {
      if (!session?.user?.id || !id) return;
      const wasFollowing = followedIds.has(id);
      setFollowedIds((prev) => {
        const next = new Set(prev);
        wasFollowing ? next.delete(id) : next.add(id);
        return next;
      });
      const { error: writeError } = wasFollowing
        ? await supabase.from(K.followTable).delete().eq("profile_id", session.user.id).eq("tmdb_id", id)
        : await supabase.from(K.followTable).insert({ profile_id: session.user.id, tmdb_id: id });
      if (writeError) {
        if (writeError.message?.includes("FOLLOW_LIMIT_REACHED")) {
          setFollowLimitError(writeError.message.replace("FOLLOW_LIMIT_REACHED: ", ""));
        }
        setFollowedIds((prev) => {
          const next = new Set(prev);
          wasFollowing ? next.add(id) : next.delete(id);
          return next;
        });
      }
    },
    [session?.user?.id, followedIds, K.followTable],
  );

  const toItem = useCallback(
    (c) => ({
      id: c.id,
      type: K.type,
      title: c.title,
      posterPath: c.poster_path ?? null,
      isFollowing: followedIds.has(c.id),
      onFollowToggle: () => toggleFollow(c.id),
      genreIds: c.genre_ids ?? [],
      followBlockedLabel: followBlock(K.type, c),
      nsfw: Boolean(c.nsfw),
    }),
    [followedIds, toggleFollow, K.type],
  );

  const loadMorePopular = useCallback(async () => {
    if (loadingMorePopular || popPage >= popTotal) return;
    setLoadingMorePopular(true);
    try {
      const { results } = await fetchPage(`/api/content/list/${K.listKind}?page=${popPage + 1}`, showAdult);
      setPopularCards((prev) => [...prev, ...results]);
      setPopPage((p) => p + 1);
    } finally {
      setLoadingMorePopular(false);
    }
  }, [loadingMorePopular, popPage, popTotal, K.listKind, showAdult]);

  const loadGenre = useCallback(
    async (genreId, genreName) => {
      const existing = genreRows[genreId];
      const nextPage = existing ? existing.page + 1 : 1;
      if (existing && existing.page >= existing.totalPages) return;
      setLoadingGenreId(genreId);
      try {
        const { results, totalPages } = await fetchPage(
          `/api/content/discover/${K.discover}?with_genres=${genreId}&page=${nextPage}`,
          showAdult,
        );
        setGenreRows((prev) => ({
          ...prev,
          [genreId]: {
            name: genreName,
            cards: [...(prev[genreId]?.cards ?? []), ...results],
            page: nextPage,
            totalPages,
          },
        }));
      } finally {
        setLoadingGenreId(null);
      }
    },
    [genreRows, K.discover, showAdult],
  );

  // Lazily prime the first page of each genre row once genres are known.
  useEffect(() => {
    if (readList(key)) return undefined; // warm — genre rows already restored (with their pagination)
    if (genres.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      const primed = {};
      await Promise.all(
        genres.slice(0, 12).map(async (g) => {
          try {
            const { results, totalPages } = await fetchPage(
              `/api/content/discover/${K.discover}?with_genres=${g.id}&page=1`,
              showAdult,
            );
            primed[g.id] = { name: g.name, cards: results, page: 1, totalPages };
          } catch {
            /* skip */
          }
        }),
      );
      if (!cancelled) setGenreRows(primed);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, genres, K.discover, showAdult]);

  // Write-through: persist the page's data so Back can restore it.
  useEffect(() => {
    if (isLoading) return;
    writeList(key, {
      popularCards,
      comingSoon,
      genres,
      genreRows,
      popPage,
      popTotal,
      followedIds,
      myServicesCards,
      myServicesPage,
      myServicesTotal,
    });
  }, [
    key,
    isLoading,
    popularCards,
    comingSoon,
    genres,
    genreRows,
    popPage,
    popTotal,
    followedIds,
    myServicesCards,
    myServicesPage,
    myServicesTotal,
  ]);

  const popular = useMemo(() => popularCards.map(toItem), [popularCards, toItem]);
  const comingSoonItems = useMemo(
    () => comingSoon.map((c) => ({ ...toItem(c), releaseLabel: formatReleaseLabel(c.date) })),
    [comingSoon, toItem],
  );
  const myServicesItems = useMemo(() => myServicesCards.map(toItem), [myServicesCards, toItem]);
  const byGenre = useMemo(
    () =>
      Object.entries(genreRows)
        .map(([id, row]) => ({
          genreId: Number(id),
          genreName: row.name,
          items: row.cards.map(toItem),
          hasMore: row.page < row.totalPages,
          onLoadMore: () => loadGenre(Number(id), row.name),
          isLoadingMore: loadingGenreId === Number(id),
        }))
        .filter((r) => r.items.length >= 3)
        .sort((a, b) => a.genreName.localeCompare(b.genreName)),
    [genreRows, toItem, loadGenre, loadingGenreId],
  );

  return {
    popular,
    comingSoonItems,
    byGenre,
    myServicesItems,
    hasMoreMyServices: myServicesPage < myServicesTotal,
    loadMoreMyServices,
    loadingMyServices,
    isLoading,
    error,
    followLimitError,
    clearFollowLimitError: () => setFollowLimitError(null),
    hasMorePopular: popPage < popTotal,
    loadMorePopular,
    loadingMorePopular,
  };
}
