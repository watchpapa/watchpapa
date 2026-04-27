import { useEffect, useReducer, useRef } from "react";
import { supabase } from "../../../lib/supabase.js";

const DEBOUNCE_MS = 300;

function reducer(state, action) {
  switch (action.type) {
    case "FETCHING":
      return { ...state, isLoading: true, status: "loading", error: null };
    case "LOADED":
      return { results: action.results, isLoading: false, status: "success", error: null };
    case "ERROR":
      return { ...state, isLoading: false, status: "error", error: action.error };
    case "CLEAR":
      return { results: [], isLoading: false, status: "idle", error: null };
    default:
      return state;
  }
}

const initialState = { results: [], isLoading: false, status: "idle", error: null };

function yearFrom(d) {
  return typeof d === "string" && d.length >= 4 ? d.slice(0, 4) : null;
}

function mergeRowsById(rowsA, rowsB, sortKey, ascending = false) {
  const map = new Map();
  for (const r of [...(rowsA ?? []), ...(rowsB ?? [])]) {
    if (r?.id != null && !map.has(r.id)) map.set(r.id, r);
  }
  const list = [...map.values()].sort((a, b) => {
    const va = a[sortKey] ?? 0;
    const vb = b[sortKey] ?? 0;
    return ascending ? va - vb : vb - va;
  });
  return list;
}

async function searchLocalSupabase(query, perTypeLimit) {
  const escaped = query.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const pattern = `%${escaped}%`;

  const [
    moviesTitleRes,
    moviesOrigRes,
    showsNameRes,
    showsOrigRes,
    peopleRes,
  ] = await Promise.all([
    supabase
      .from("movie")
      .select("id, tmdb_id, title, poster_path, tmdb_popularity, release_date")
      .is("deleted_at", null)
      .ilike("title", pattern)
      .order("tmdb_popularity", { ascending: false })
      .limit(perTypeLimit),
    supabase
      .from("movie")
      .select("id, tmdb_id, title, poster_path, tmdb_popularity, release_date")
      .is("deleted_at", null)
      .ilike("original_title", pattern)
      .order("tmdb_popularity", { ascending: false })
      .limit(perTypeLimit),
    supabase
      .from("show")
      .select("id, tmdb_id, name, poster_path, tmdb_popularity, first_air_date")
      .is("deleted_at", null)
      .ilike("name", pattern)
      .order("tmdb_popularity", { ascending: false })
      .limit(perTypeLimit),
    supabase
      .from("show")
      .select("id, tmdb_id, name, poster_path, tmdb_popularity, first_air_date")
      .is("deleted_at", null)
      .ilike("original_name", pattern)
      .order("tmdb_popularity", { ascending: false })
      .limit(perTypeLimit),
    supabase
      .from("person")
      .select("id, tmdb_id, name, profile_path, popularity")
      .is("deleted_at", null)
      .ilike("name", pattern)
      .order("popularity", { ascending: false })
      .limit(perTypeLimit),
  ]);

  const movieRows = mergeRowsById(
    moviesTitleRes.data,
    moviesOrigRes.data,
    "tmdb_popularity",
    false
  ).slice(0, perTypeLimit);
  const showRows = mergeRowsById(
    showsNameRes.data,
    showsOrigRes.data,
    "tmdb_popularity",
    false
  ).slice(0, perTypeLimit);

  const movies = movieRows.map((r) => ({
    type: "movie",
    localId: r.id,
    tmdbId: r.tmdb_id,
    title: r.title,
    posterPath: r.poster_path ?? null,
    year: yearFrom(r.release_date),
    popularity: r.tmdb_popularity ?? 0,
  }));

  const shows = showRows.map((r) => ({
    type: "show",
    localId: r.id,
    tmdbId: r.tmdb_id,
    title: r.name,
    posterPath: r.poster_path ?? null,
    year: yearFrom(r.first_air_date),
    popularity: r.tmdb_popularity ?? 0,
  }));

  const people = (peopleRes.data ?? []).map((r) => ({
    type: "person",
    localId: r.id,
    tmdbId: r.tmdb_id,
    title: r.name,
    posterPath: r.profile_path ?? null,
    year: null,
    popularity: r.popularity ?? 0,
  }));

  return [...movies, ...shows, ...people];
}

export function useSearch(query, { perTypeLimit = 5 } = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const timerRef = useRef(null);
  const genRef = useRef(0);

  useEffect(() => {
    const trimmed = (query ?? "").trim();

    if (trimmed.length < 2) {
      clearTimeout(timerRef.current);
      dispatch({ type: "CLEAR" });
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const gen = ++genRef.current;
      const stale = () => gen !== genRef.current;

      dispatch({ type: "FETCHING" });

      searchLocalSupabase(trimmed, perTypeLimit)
        .then((results) => {
          if (stale()) return;
          dispatch({ type: "LOADED", results });
        })
        .catch(() => {
          if (!stale()) dispatch({ type: "ERROR", error: "Search failed" });
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [query, perTypeLimit]);

  return state;
}
