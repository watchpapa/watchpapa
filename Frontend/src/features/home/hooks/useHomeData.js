// Used by:
// - Frontend/src/pages/app/AppHomePage.jsx
//
// Home rows come from the watchpapa Worker (TMDB popular / discover-upcoming).
// Follow state + toggles stay in Supabase, keyed by tmdb_id.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { apiFetch } from "../../../lib/api.js";

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
  };
}

async function fetchList(kind, page, includeAdult) {
  const q = new URLSearchParams({ page: String(page) });
  if (includeAdult) q.set("include_adult", "true");
  const { results, total_pages } = await apiFetch(`/api/content/list/${kind}?${q}`);
  return { results: results ?? [], totalPages: total_pages ?? 1 };
}

export function useHomeData(session, showAdult = false) {
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
  const [busy, setBusy] = useState({ movies: false, shows: false, popular: false });

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
        }
      } catch {
        /* ignore */
      } finally {
        setBusy((b) => ({ ...b, [which]: false }));
      }
    },
    [busy, moviePage, showPage, movieTotal, showTotal, showAdult],
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
    isLoading,
    error,
    followLimitError,
    clearFollowLimitError: () => setFollowLimitError(null),
    hasMoreMovies: moviePage < movieTotal,
    hasMoreShows: showPage < showTotal,
    hasMorePopular: popularCount < movieItems.length + showItems.length || moviePage < movieTotal || showPage < showTotal,
    loadMoreMovies: () => loadMore("movies"),
    loadMoreShows: () => loadMore("shows"),
    loadMorePopular: () => loadMore("popular"),
    loadingMoreMovies: busy.movies,
    loadingMoreShows: busy.shows,
    loadingMorePopular: busy.popular,
  };
}
