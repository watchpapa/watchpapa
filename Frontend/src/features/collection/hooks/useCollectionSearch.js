// Used by:
// - Frontend/src/pages/app/CollectionsPage.jsx
//
// Debounced search against GET /api/content/search/collections (TMDB has no
// "browse all collections" endpoint, only /search/collection — so this page
// is search-only). Same debounce/pagination shape as
// features/search/hooks/useSearch.js, trimmed down for one result type.
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api.js";

const DEBOUNCE_MS = 300;

export function useCollectionSearch(query) {
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const genRef = useRef(0);
  const trimmedRef = useRef("");

  useEffect(() => {
    const trimmed = (query ?? "").trim();
    trimmedRef.current = trimmed;
    clearTimeout(timerRef.current);
    if (trimmed.length < 2) {
      genRef.current += 1;
      setResults([]);
      setPage(1);
      setTotalPages(1);
      setIsLoading(false);
      setError(null);
      return;
    }
    timerRef.current = setTimeout(() => {
      const gen = ++genRef.current;
      setIsLoading(true);
      setError(null);
      apiFetch(`/api/content/search/collections?q=${encodeURIComponent(trimmed)}&page=1`)
        .then((d) => {
          if (gen !== genRef.current) return;
          setResults(d.results ?? []);
          setPage(d.page ?? 1);
          setTotalPages(d.total_pages ?? 1);
        })
        .catch(() => {
          if (gen === genRef.current) setError("Search failed");
        })
        .finally(() => {
          if (gen === genRef.current) setIsLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const loadMore = useCallback(() => {
    const trimmed = trimmedRef.current;
    if (trimmed.length < 2 || isLoadingMore || page >= totalPages) return;
    const nextPage = page + 1;
    const gen = genRef.current;
    setIsLoadingMore(true);
    apiFetch(`/api/content/search/collections?q=${encodeURIComponent(trimmed)}&page=${nextPage}`)
      .then((d) => {
        if (gen !== genRef.current) return;
        setResults((prev) => [...prev, ...(d.results ?? [])]);
        setPage(d.page ?? nextPage);
        setTotalPages(d.total_pages ?? nextPage);
      })
      .catch(() => {
        if (gen === genRef.current) setError("Search failed");
      })
      .finally(() => {
        if (gen === genRef.current) setIsLoadingMore(false);
      });
  }, [isLoadingMore, page, totalPages]);

  return { results, isLoading, isLoadingMore, error, hasMore: page < totalPages, loadMore };
}
