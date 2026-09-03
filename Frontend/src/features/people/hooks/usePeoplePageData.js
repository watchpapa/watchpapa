// Used by:
// - Frontend/src/pages/app/PeoplePage.jsx
//
// People come from TMDB /person/popular via the Worker. TMDB paginates 20/page.
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api.js";

export function usePeoplePageData(showAdult = false) {
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const pageRef = useRef(1);
  const totalPagesRef = useRef(1);
  const busyRef = useRef(false);

  const loadPage = useCallback(async (page) => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (page === 1) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const q = new URLSearchParams({ page: String(page) });
      if (showAdult) q.set("include_adult", "true");
      const { results, total_pages } = await apiFetch(`/api/content/list/people-popular?${q}`);
      totalPagesRef.current = total_pages ?? 1;
      // Card → the shape PeoplePage reads (name, profile_path via poster_path).
      const rows = (results ?? []).map((c) => ({
        id: c.id,
        name: c.title,
        profile_path: c.poster_path,
        popularity: c.tmdb_popularity,
        known_for_department: c.known_for_department ?? null,
      }));
      setPeople((prev) => (page === 1 ? rows : [...prev, ...rows]));
      setHasMore(page < totalPagesRef.current);
      pageRef.current = page;
    } catch (e) {
      setError(e.message);
    } finally {
      busyRef.current = false;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [showAdult]);

  useEffect(() => {
    pageRef.current = 1;
    loadPage(1);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!busyRef.current && hasMore) loadPage(pageRef.current + 1);
  }, [hasMore, loadPage]);

  return { people, isLoading, isLoadingMore, hasMore, loadMore, error };
}
