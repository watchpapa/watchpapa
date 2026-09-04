// Used by:
// - Frontend/src/components/home/SearchBar.jsx
// - Frontend/src/pages/app/SearchPage.jsx
//
// Single debounced call to the Worker /api/search (TMDB multi-search). No local
// phase, no `needsInjection` — every result links straight to /movies|shows|people/:tmdbId.
import { useEffect, useReducer, useRef } from "react";
import { apiFetch } from "../../../lib/api.js";
import { usePreferences } from "../../preferences/PreferencesContext.jsx";

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

// `showAdult` defaults to the user's real preference (from context) when the
// caller doesn't pass one explicitly — fixes the navbar typeahead always
// searching with adult content off regardless of the user's setting.
export function useSearch(query, opts = {}) {
  const prefs = usePreferences();
  const showAdult = opts.showAdult ?? prefs.showAdult;
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

      apiFetch(`/api/search?q=${encodeURIComponent(trimmed)}&include_adult=${showAdult}`)
        .then((d) => {
          if (stale()) return;
          // Result shape: { type, tmdbId, title, posterPath, year, popularity, adult }
          const results = (d.results ?? [])
            .slice()
            .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
          dispatch({ type: "LOADED", results });
        })
        .catch(() => {
          if (!stale()) dispatch({ type: "ERROR", error: "Search failed" });
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [query, showAdult]);

  return state;
}
