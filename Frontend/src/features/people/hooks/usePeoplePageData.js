import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const PAGE_SIZE = 20;

export function usePeoplePageData() {
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const pageRef = useRef(0);
  const busyRef = useRef(false);

  const loadPage = useCallback(async (pageNum) => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (pageNum === 0) setIsLoading(true);
    else setIsLoadingMore(true);

    const from = pageNum * PAGE_SIZE;
    const { data, error: err } = await supabase
      .from("person")
      .select("id, name, profile_path, popularity, birthday, place_of_birth")
      .is("deleted_at", null)
      .order("popularity", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

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

  useEffect(() => { loadPage(0); }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!busyRef.current && hasMore) loadPage(pageRef.current + 1);
  }, [hasMore, loadPage]);

  return { people, isLoading, isLoadingMore, hasMore, loadMore, error };
}
