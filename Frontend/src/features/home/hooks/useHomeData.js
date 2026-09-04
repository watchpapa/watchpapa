// Used by:
// - Frontend/src/pages/app/AppHomePage.jsx
//
// Home rows come from the watchpapa Worker (TMDB popular / discover-upcoming).
// Follow state + toggles stay in Supabase, keyed by tmdb_id.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { apiFetch } from "../../../lib/api.js";
import { followBlock } from "../../../lib/followGate.js";
import { usePreferences } from "../../preferences/PreferencesContext.jsx";

function formatReleaseLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function cardToItem(c, followedSet) {
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    posterPath: c.poster_path ?? null,
    tmdbPopularity: c.tmdb_popularity ?? 0,
    genreIds: c.genre_ids ?? [],
    isFollowing: followedSet.has(c.id),
    date: c.date ?? null,
    followBlockedLabel: followBlock(c.type, c),
  };
}

async function fetchList(kind, page, includeAdult) {
  const q = new URLSearchParams({ page: String(page) });
  if (includeAdult) q.set("include_adult", "true");
  const { results, total_pages } = await apiFetch(`/api/content/list/${kind}?${q}`);
  return { results: results ?? [], totalPages: total_pages ?? 1 };
}

async function fetchMyServicesPage(type, page, includeAdult, providersKey, region) {
  const q = new URLSearchParams({
    page: String(page),
    with_watch_providers: providersKey,
    watch_region: region,
    with_watch_monetization_types: "flatrate|free|ads",
  });
  if (includeAdult) q.set("include_adult", "true");
  const { results, total_pages } = await apiFetch(`/api/content/discover/${type}?${q}`);
  return { results: results ?? [], totalPages: total_pages ?? 1 };
}

export function useHomeData(session, showAdult = false) {
  const { watchProviders, effectiveWatchRegions } = usePreferences();
  const myServicesRegion = effectiveWatchRegions[0] ?? null;
  const providersKey = watchProviders.slice().sort((a, b) => a - b).join("|");

  const [movieCards, setMovieCards] = useState([]);
  const [showCards, setShowCards] = useState([]);
  const [comingSoon, setComingSoon] = useState([]);
  const [followedMovieIds, setFollowedMovieIds] = useState(new Set());
  const [followedShowIds, setFollowedShowIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [followLimitError, setFollowLimitError] = useState(null);

  const [moviePage, setMoviePage] = useState(1);
  const [showPage, setShowPage] = useState(1);
  const [movieTotal, setMovieTotal] = useState(1);
  const [showTotal, setShowTotal] = useState(1);
  const [popularCount, setPopularCount] = useState(20);
  const [busy, setBusy] = useState({ movies: false, shows: false, popular: false, myServices: false });

  const [myServicesMovieCards, setMyServicesMovieCards] = useState([]);
  const [myServicesShowCards, setMyServicesShowCards] = useState([]);
  const [myServicesMoviePage, setMyServicesMoviePage] = useState(1);
  const [myServicesShowPage, setMyServicesShowPage] = useState(1);
  const [myServicesMovieTotal, setMyServicesMovieTotal] = useState(1);
  const [myServicesShowTotal, setMyServicesShowTotal] = useState(1);
  const [myServicesCount, setMyServicesCount] = useState(20);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const [mv, sh, csMv, csSh] = await Promise.all([
          fetchList("movies-popular", 1, showAdult),
          fetchList("shows-popular", 1, showAdult),
          apiFetch(`/api/content/discover/movie?upcoming=1${showAdult ? "&include_adult=true" : ""}`),
          apiFetch(`/api/content/discover/tv?upcoming=1${showAdult ? "&include_adult=true" : ""}`),
        ]);
        if (cancelled) return;
        setMovieCards(mv.results);
        setShowCards(sh.results);
        setMovieTotal(mv.totalPages);
        setShowTotal(sh.totalPages);
        setMoviePage(1);
        setShowPage(1);
        setPopularCount(20);
        setComingSoon([...(csMv.results ?? []), ...(csSh.results ?? [])]);

        if (session?.user?.id) {
          const [fm, fs] = await Promise.all([
            supabase.from("user_followed_movies").select("tmdb_id").eq("profile_id", session.user.id),
            supabase.from("user_followed_shows").select("tmdb_id").eq("profile_id", session.user.id),
          ]);
          if (!cancelled) {
            setFollowedMovieIds(new Set((fm.data ?? []).map((r) => Number(r.tmdb_id))));
            setFollowedShowIds(new Set((fs.data ?? []).map((r) => Number(r.tmdb_id))));
          }
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
  }, [session?.user?.id, showAdult]);

  // "Popular on my streamings" — independent of the fetch above, only runs
  // once the user has picked at least one provider (Pro+ only, see
  // SettingsPage) and a watch region.
  useEffect(() => {
    if (!providersKey || !myServicesRegion) {
      setMyServicesMovieCards([]);
      setMyServicesShowCards([]);
      setMyServicesMoviePage(1);
      setMyServicesShowPage(1);
      setMyServicesMovieTotal(1);
      setMyServicesShowTotal(1);
      setMyServicesCount(20);
      return;
    }
    let cancelled = false;
    (async () => {
      setBusy((b) => ({ ...b, myServices: true }));
      try {
        const [mv, sh] = await Promise.all([
          fetchMyServicesPage("movie", 1, showAdult, providersKey, myServicesRegion),
          fetchMyServicesPage("tv", 1, showAdult, providersKey, myServicesRegion),
        ]);
        if (cancelled) return;
        setMyServicesMovieCards(mv.results);
        setMyServicesShowCards(sh.results);
        setMyServicesMoviePage(1);
        setMyServicesShowPage(1);
        setMyServicesMovieTotal(mv.totalPages);
        setMyServicesShowTotal(sh.totalPages);
        setMyServicesCount(20);
      } catch {
        if (!cancelled) {
          setMyServicesMovieCards([]);
          setMyServicesShowCards([]);
        }
      } finally {
        if (!cancelled) setBusy((b) => ({ ...b, myServices: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providersKey, myServicesRegion, showAdult]);

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

  const loadMore = useCallback(
    async (which) => {
      if (busy[which]) return;
      setBusy((b) => ({ ...b, [which]: true }));
      try {
        if (which === "movies" && moviePage < movieTotal) {
          const { results } = await fetchList("movies-popular", moviePage + 1, showAdult);
          setMovieCards((prev) => [...prev, ...results]);
          setMoviePage((p) => p + 1);
        } else if (which === "shows" && showPage < showTotal) {
          const { results } = await fetchList("shows-popular", showPage + 1, showAdult);
          setShowCards((prev) => [...prev, ...results]);
          setShowPage((p) => p + 1);
        } else if (which === "popular") {
          // Pull one more page of each so the merged list can grow.
          const tasks = [];
          if (moviePage < movieTotal) tasks.push(fetchList("movies-popular", moviePage + 1, showAdult).then((r) => { setMovieCards((p) => [...p, ...r.results]); setMoviePage((p) => p + 1); }));
          if (showPage < showTotal) tasks.push(fetchList("shows-popular", showPage + 1, showAdult).then((r) => { setShowCards((p) => [...p, ...r.results]); setShowPage((p) => p + 1); }));
          await Promise.all(tasks);
          setPopularCount((c) => c + 20);
        } else if (which === "myServices" && providersKey && myServicesRegion) {
          const tasks = [];
          if (myServicesMoviePage < myServicesMovieTotal) {
            tasks.push(
              fetchMyServicesPage("movie", myServicesMoviePage + 1, showAdult, providersKey, myServicesRegion).then((r) => {
                setMyServicesMovieCards((p) => [...p, ...r.results]);
                setMyServicesMoviePage((p) => p + 1);
              }),
            );
          }
          if (myServicesShowPage < myServicesShowTotal) {
            tasks.push(
              fetchMyServicesPage("tv", myServicesShowPage + 1, showAdult, providersKey, myServicesRegion).then((r) => {
                setMyServicesShowCards((p) => [...p, ...r.results]);
                setMyServicesShowPage((p) => p + 1);
              }),
            );
          }
          await Promise.all(tasks);
          setMyServicesCount((c) => c + 20);
        }
      } catch {
        /* ignore */
      } finally {
        setBusy((b) => ({ ...b, [which]: false }));
      }
    },
    [
      busy,
      moviePage,
      showPage,
      movieTotal,
      showTotal,
      showAdult,
      myServicesMoviePage,
      myServicesShowPage,
      myServicesMovieTotal,
      myServicesShowTotal,
      providersKey,
      myServicesRegion,
    ],
  );

  const today = new Date().toISOString().slice(0, 10);

  const movieItems = useMemo(
    () => movieCards.map((c) => ({ ...cardToItem(c, followedMovieIds), onFollowToggle: () => toggleFollow("movie", c.id) })),
    [movieCards, followedMovieIds, toggleFollow],
  );
  const showItems = useMemo(
    () => showCards.map((c) => ({ ...cardToItem(c, followedShowIds), onFollowToggle: () => toggleFollow("show", c.id) })),
    [showCards, followedShowIds, toggleFollow],
  );
  const popular = useMemo(() => {
    return [...movieItems, ...showItems]
      .sort((a, b) => b.tmdbPopularity - a.tmdbPopularity)
      .slice(0, popularCount);
  }, [movieItems, showItems, popularCount]);

  const myServicesMovieItems = useMemo(
    () => myServicesMovieCards.map((c) => ({ ...cardToItem(c, followedMovieIds), onFollowToggle: () => toggleFollow("movie", c.id) })),
    [myServicesMovieCards, followedMovieIds, toggleFollow],
  );
  const myServicesShowItems = useMemo(
    () => myServicesShowCards.map((c) => ({ ...cardToItem(c, followedShowIds), onFollowToggle: () => toggleFollow("show", c.id) })),
    [myServicesShowCards, followedShowIds, toggleFollow],
  );
  const myServicesItems = useMemo(
    () =>
      [...myServicesMovieItems, ...myServicesShowItems]
        .sort((a, b) => b.tmdbPopularity - a.tmdbPopularity)
        .slice(0, myServicesCount),
    [myServicesMovieItems, myServicesShowItems, myServicesCount],
  );

  const comingSoonItems = useMemo(
    () =>
      comingSoon
        .map((c) => {
          const followed = c.type === "movie" ? followedMovieIds : followedShowIds;
          return {
            ...cardToItem(c, followed),
            releaseLabel:
              c.type === "movie"
                ? formatReleaseLabel(c.date)
                : c.date && c.date > today
                  ? formatReleaseLabel(c.date)
                  : "Airing",
            onFollowToggle: () => toggleFollow(c.type, c.id),
          };
        })
        .sort((a, b) => b.tmdbPopularity - a.tmdbPopularity),
    [comingSoon, followedMovieIds, followedShowIds, toggleFollow, today],
  );

  return {
    popular,
    comingSoonItems,
    movieItems,
    showItems,
    myServicesItems,
    isLoading,
    error,
    followLimitError,
    clearFollowLimitError: () => setFollowLimitError(null),
    hasMoreMovies: moviePage < movieTotal,
    hasMoreShows: showPage < showTotal,
    hasMorePopular: popularCount < movieItems.length + showItems.length || moviePage < movieTotal || showPage < showTotal,
    hasMoreMyServices:
      myServicesCount < myServicesMovieItems.length + myServicesShowItems.length ||
      myServicesMoviePage < myServicesMovieTotal ||
      myServicesShowPage < myServicesShowTotal,
    loadMoreMovies: () => loadMore("movies"),
    loadMoreShows: () => loadMore("shows"),
    loadMorePopular: () => loadMore("popular"),
    loadMoreMyServices: () => loadMore("myServices"),
    loadingMoreMovies: busy.movies,
    loadingMoreShows: busy.shows,
    loadingMorePopular: busy.popular,
    loadingMoreMyServices: busy.myServices,
  };
}
