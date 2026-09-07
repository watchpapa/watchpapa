// Used by:
// - Frontend/src/components/home/SearchBar.jsx
// - Frontend/src/pages/app/SearchPage.jsx
//
// Single debounced call to the Worker /api/search (TMDB multi-search), with
// pagination support for the full /search page. No local phase, no
// `needsInjection` — every result links straight to /movies|shows|people/:tmdbId.
import { useCallback, useEffect, useReducer, useRef } from "react";
import { apiFetch } from "../../../lib/api.js";
import { listKey, readList, writeList } from "../../../lib/listCache.js";
import { usePreferences } from "../../preferences/PreferencesContext.jsx";

const DEBOUNCE_MS = 300;

function reducer(state, action) {
  switch (action.type) {
    case "FETCHING":
      return { ...initialState, isLoading: true, status: "loading" };
    case "LOADED":
      return {
        results: action.results,
        isLoading: false,
        isLoadingMore: false,
        status: "success",
        error: null,
        page: action.page,
        totalPages: action.totalPages,
      };
    case "LOADING_MORE":
      return { ...state, isLoadingMore: true };
    case "LOADED_MORE":
      return {
        ...state,
        // Dedupe defensively — TMDB can occasionally repeat a row across
        // adjacent pages when new content is inserted mid-pagination.
        results: dedupe([...state.results, ...action.results]),
        isLoadingMore: false,
        page: action.page,
        totalPages: action.totalPages,
      };
    case "ERROR":
      return { ...state, isLoading: false, isLoadingMore: false, status: "error", error: action.error };
    case "CLEAR":
      return initialState;
    default:
      return state;
  }
}

function dedupe(results) {
  const seen = new Set();
  const out = [];
  for (const r of results) {
    const key = `${r.type}-${r.tmdbId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

const initialState = {
  results: [],
  isLoading: false,
  isLoadingMore: false,
  status: "idle",
  error: null,
  page: 1,
  totalPages: 1,
};

const cacheKey = (q, showAdult) => listKey("search", { q, showAdult });

// `showAdult` defaults to the user's real preference (from context) when the
// caller doesn't pass one explicitly — fixes the navbar typeahead always
// searching with adult content off regardless of the user's setting.
// Pass `opts.cache` (SearchPage does) to snapshot results per query so Back
// restores them instead of re-searching.
export function useSearch(query, opts = {}) {
  const prefs = usePreferences();
  const showAdult = opts.showAdult ?? prefs.showAdult;
  const cacheEnabled = !!opts.cache;
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const t = (query ?? "").trim();
    const warm = cacheEnabled && t.length >= 2 ? readList(cacheKey(t, showAdult)) : undefined;
    return warm
      ? { ...initialState, results: warm.results, status: "success", page: warm.page, totalPages: warm.totalPages }
      : initialState;
  });
  const timerRef = useRef(null);
  const genRef = useRef(0);
  const trimmedRef = useRef("");

  useEffect(() => {
    const trimmed = (query ?? "").trim();
    trimmedRef.current = trimmed;
    if (trimmed.length < 2) {
      clearTimeout(timerRef.current);
      dispatch({ type: "CLEAR" });
      return;
    }

    const warm = cacheEnabled ? readList(cacheKey(trimmed, showAdult)) : undefined;
    if (warm) {
      clearTimeout(timerRef.current);
      genRef.current += 1; // drop any in-flight response
      dispatch({ type: "LOADED", results: warm.results, page: warm.page, totalPages: warm.totalPages });
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const gen = ++genRef.current;
      const stale = () => gen !== genRef.current;
      dispatch({ type: "FETCHING" });

      apiFetch(`/api/search?q=${encodeURIComponent(trimmed)}&page=1&include_adult=${showAdult}`)
        .then((d) => {
          if (stale()) return;
          // Result shape: { type, tmdbId, title, posterPath, year, date,
          // popularity, voteAverage, adult }. Order is TMDB's own relevance
          // ranking (via /search/multi) — no client-side re-sort.
          dispatch({ type: "LOADED", results: d.results ?? [], page: d.page ?? 1, totalPages: d.total_pages ?? 1 });
        })
        .catch(() => {
          if (!stale()) dispatch({ type: "ERROR", error: "Search failed" });
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [query, showAdult, cacheEnabled]);

  // Write-through: snapshot each query's results (SearchPage only).
  useEffect(() => {
    if (!cacheEnabled || state.status !== "success") return;
    const t = trimmedRef.current;
    if (t.length < 2) return;
    writeList(cacheKey(t, showAdult), { results: state.results, page: state.page, totalPages: state.totalPages });
  }, [cacheEnabled, showAdult, state.status, state.results, state.page, state.totalPages]);

  const loadMore = useCallback(() => {
    const trimmed = trimmedRef.current;
    if (trimmed.length < 2 || state.isLoadingMore || state.page >= state.totalPages) return;
    const nextPage = state.page + 1;
    const gen = genRef.current;
    const stale = () => gen !== genRef.current;
    dispatch({ type: "LOADING_MORE" });

    apiFetch(`/api/search?q=${encodeURIComponent(trimmed)}&page=${nextPage}&include_adult=${showAdult}`)
      .then((d) => {
        if (stale()) return;
        dispatch({ type: "LOADED_MORE", results: d.results ?? [], page: d.page ?? nextPage, totalPages: d.total_pages ?? nextPage });
      })
      .catch(() => {
        if (!stale()) dispatch({ type: "ERROR", error: "Search failed" });
      });
  }, [state.isLoadingMore, state.page, state.totalPages, showAdult]);

  return { ...state, hasMore: state.page < state.totalPages, loadMore };
}
