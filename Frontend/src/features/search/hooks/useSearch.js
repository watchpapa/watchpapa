// Used by:
// - Frontend/src/components/home/SearchBar.jsx
// - Frontend/src/pages/app/SearchPage.jsx
import { useEffect, useReducer, useRef } from "react";
import { supabase } from "../../../lib/supabase.js";

const DEBOUNCE_MS = 300;

// Apply state updates for debounced search results.
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

// Extract a 4-digit year string from a date value.
function yearFrom(d) {
  return typeof d === "string" && d.length >= 4 ? d.slice(0, 4) : null;
}

// Merge result arrays by id and sort by popularity key.
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

// Search local Supabase tables for movies, shows, and people.
async function searchLocalSupabase(query, perTypeLimit, showAdult) {
  const escaped = query.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const pattern = `%${escaped}%`;

  // Apply adult filter to each table query when needed.
  const applyAdultFilter = (q) => (showAdult ? q : q.eq("adult", false));

  const [
    moviesTitleRes,
    moviesOrigRes,
    showsNameRes,
    showsOrigRes,
    peopleRes,
  ] = await Promise.all([
    applyAdultFilter(supabase
      .from("movie")
      .select("id, tmdb_id, title, poster_path, tmdb_popularity, release_date")
      .is("deleted_at", null)
      .ilike("title", pattern)
      .order("tmdb_popularity", { ascending: false })
      .limit(perTypeLimit)),
    applyAdultFilter(supabase
      .from("movie")
      .select("id, tmdb_id, title, poster_path, tmdb_popularity, release_date")
      .is("deleted_at", null)
      .ilike("original_title", pattern)
      .order("tmdb_popularity", { ascending: false })
      .limit(perTypeLimit)),
    applyAdultFilter(supabase
      .from("show")
      .select("id, tmdb_id, name, poster_path, tmdb_popularity, first_air_date")
      .is("deleted_at", null)
      .ilike("name", pattern)
      .order("tmdb_popularity", { ascending: false })
      .limit(perTypeLimit)),
    applyAdultFilter(supabase
      .from("show")
      .select("id, tmdb_id, name, poster_path, tmdb_popularity, first_air_date")
      .is("deleted_at", null)
      .ilike("original_name", pattern)
      .order("tmdb_popularity", { ascending: false })
      .limit(perTypeLimit)),
    applyAdultFilter(supabase
      .from("person")
      .select("id, tmdb_id, name, profile_path, popularity")
      .is("deleted_at", null)
      .ilike("name", pattern)
      .order("popularity", { ascending: false })
      .limit(perTypeLimit)),
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

// Run debounced search and merge local and backend results.
export function useSearch(query, { perTypeLimit = 5, backendLimit = 30, showAdult = false } = {}) {
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

      searchLocalSupabase(trimmed, perTypeLimit, showAdult)
        .then((localResults) => {
          if (stale()) return;
          dispatch({ type: "LOADED", results: localResults });

          // Phase 2: enrich with TMDB-only items from backend
          // Use String() on both sides — Supabase returns bigint tmdb_id as string,
          // backend Sequelize returns it as number, so Set.has() would fail without normalization.
          const localTmdbIds = new Set(localResults.map((r) => String(r.tmdbId)));
          fetch(
            `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/search?q=${encodeURIComponent(trimmed)}&limit=${backendLimit}&localPerType=${perTypeLimit}&includeAdult=${showAdult}`
          )
            .then((r) => {
              if (!r.ok) throw new Error(r.status);
              return r.json();
            })
            .then((d) => {
              if (stale()) return;
              const tmdbOnly = (d.results ?? [])
                .filter((r) => !localTmdbIds.has(String(r.tmdbId)))
                .map((r) => ({ ...r, needsInjection: true }));
              if (tmdbOnly.length > 0) {
                dispatch({ type: "LOADED", results: [...localResults, ...tmdbOnly] });
              }
            })
            .catch(() => {
              // backend unavailable — local results already visible
            });
        })
        .catch(() => {
          if (!stale()) dispatch({ type: "ERROR", error: "Search failed" });
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [query, perTypeLimit, backendLimit, showAdult]);

  return state;
}
