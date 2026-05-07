// Used by:
// - Frontend/src/pages/app/PeoplePage.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const PAGE_SIZE = 20;

// Load and paginate people data for the People page.
export function usePeoplePageData(showAdult = false) {
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const pageRef = useRef(0);
  const busyRef = useRef(false);
  const showAdultRef = useRef(showAdult);
  showAdultRef.current = showAdult;

  // Fetch one people page from the database.
  const loadPage = useCallback(async (pageNum) => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (pageNum === 0) setIsLoading(true);
    else setIsLoadingMore(true);

    const from = pageNum * PAGE_SIZE;
    // Read people rows ordered by popularity from the person table.
    let q = supabase
      .from("person")
      .select("id, name, profile_path, popularity, birthday, place_of_birth")
      .is("deleted_at", null)
      .order("popularity", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (!showAdultRef.current) q = q.eq("adult", false);
    const { data, error: err } = await q;

    busyRef.current = false;

    if (err) {
      setError(err.message);
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    const rows = data ?? [];
    if (pageNum === 0) {
      setPeople(rows);
      setIsLoading(false);
    } else {
      setPeople((prev) => [...prev, ...rows]);
      setIsLoadingMore(false);
    }

    setHasMore(rows.length === PAGE_SIZE);
    pageRef.current = pageNum;
  }, []);

  // Reset paging and reload when adult-content preference changes.
  useEffect(() => {
    pageRef.current = 0;
    loadPage(0);
  }, [loadPage, showAdult]);

  // Load the next page when more database rows are available.
  const loadMore = useCallback(() => {
    if (!busyRef.current && hasMore) loadPage(pageRef.current + 1);
  }, [hasMore, loadPage]);

  return { people, isLoading, isLoadingMore, hasMore, loadMore, error };
}
