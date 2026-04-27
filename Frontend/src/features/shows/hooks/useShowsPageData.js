import { useCallback, useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";

const FETCH_LIMIT = 200;
const ROW_LIMIT = 20;
const MIN_GENRE_COUNT = 3;

function reducer(state, action) {
  switch (action.type) {
    case "LOADED":
      return { ...state, ...action.payload, isLoading: false, error: null };
    case "ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "TOGGLE": {
      const next = new Set(state.followedIds);
      next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      return { ...state, followedIds: next };
    }
    default:
      return state;
  }
}

export function useShowsPageData(session) {
  const [state, dispatch] = useReducer(reducer, {
    shows: [],
    followedIds: new Set(),
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [showsRes, followRes] = await Promise.all([
          supabase
            .from("show")
            .select("id, name, poster_path, tmdb_popularity, show_genre(genres(id, name))")
            .is("deleted_at", null)
            .order("tmdb_popularity", { ascending: false })
            .limit(FETCH_LIMIT),
          session?.user?.id
            ? supabase.from("user_followed_shows").select("show_id").eq("profile_id", session.user.id)
            : Promise.resolve({ data: [] }),
        ]);

        if (showsRes.error) throw showsRes.error;
        if (cancelled) return;

        dispatch({
          type: "LOADED",
          payload: {
            shows: showsRes.data ?? [],
            followedIds: new Set((followRes.data ?? []).map((r) => r.show_id)),
          },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const toggleFollow = useCallback(async (showId) => {
    if (!session?.user?.id) return;
    const was = state.followedIds.has(showId);
    dispatch({ type: "TOGGLE", id: showId });
    const { error } = was
      ? await supabase.from("user_followed_shows").delete().eq("profile_id", session.user.id).eq("show_id", showId)
      : await supabase.from("user_followed_shows").insert({ profile_id: session.user.id, show_id: showId });
    if (error) dispatch({ type: "TOGGLE", id: showId });
  }, [session?.user?.id, state.followedIds]);

  const { shows, followedIds, isLoading, error } = state;

  const toItem = (row) => ({
    id: row.id,
    type: "show",
    title: row.name,
    posterPath: row.poster_path ?? null,
    isFollowing: followedIds.has(row.id),
    onFollowToggle: () => toggleFollow(row.id),
  });

  const popular = shows.slice(0, ROW_LIMIT).map(toItem);

  const genreMap = new Map();
  for (const show of shows) {
    for (const sg of (show.show_genre ?? [])) {
      const genre = sg.genres;
      if (!genre) continue;
      if (!genreMap.has(genre.id)) genreMap.set(genre.id, { id: genre.id, name: genre.name, shows: [] });
      const entry = genreMap.get(genre.id);
      if (entry.shows.length < ROW_LIMIT) entry.shows.push(show);
    }
  }

  const byGenre = [...genreMap.values()]
    .filter((g) => g.shows.length >= MIN_GENRE_COUNT)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => ({ genreId: g.id, genreName: g.name, items: g.shows.map(toItem) }));

  return { popular, byGenre, isLoading, error };
}
