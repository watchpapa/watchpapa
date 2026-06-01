import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// Username search via the search_profiles RPC. Debounced.
export function useUserSearch(query) {
  const q = (query ?? "").trim();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | done

  useEffect(() => {
    if (q.length < 1) {
      setResults([]);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setStatus("loading");
    const handle = setTimeout(() => {
      supabase
        .rpc("search_profiles", { p_query: q, p_limit: 30 })
        .then(({ data }) => {
          if (cancelled) return;
          setResults(data ?? []);
          setLoading(false);
          setStatus("done");
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q]);

  return { results, loading, status };
}
