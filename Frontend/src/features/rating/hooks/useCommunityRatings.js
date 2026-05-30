import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { isValidId } from "../../../lib/validate.js";

// Fetches all ratings for one content item (no auth required — anon can read).
// Returns histogram {1..10: count}, avg (1 decimal), total.
// Used for the sidebar histogram widget on detail pages.
export function useCommunityRatings(mediaType, entityId) {
  const id = entityId ? parseInt(entityId, 10) : null;
  const [histogram, setHistogram] = useState({});
  const [avg, setAvg] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id || !mediaType || !isValidId(id)) {
      setHistogram({});
      setAvg(null);
      setTotal(0);
      return;
    }
    let cancelled = false;
    const col = `${mediaType}_id`;
    setLoading(true);

    supabase
      .from("user_rating")
      .select("value")
      .eq(col, id)
      .then(({ data }) => {
        if (cancelled) return;
        setLoading(false);
        if (!data || data.length === 0) {
          setHistogram({});
          setAvg(null);
          setTotal(0);
          return;
        }
        const hist = {};
        let sum = 0;
        for (const row of data) {
          hist[row.value] = (hist[row.value] ?? 0) + 1;
          sum += row.value;
        }
        setHistogram(hist);
        setTotal(data.length);
        setAvg(Math.round((sum / data.length) * 10) / 10);
      });

    return () => { cancelled = true; };
  }, [mediaType, id]);

  return { histogram, avg, total, loading };
}
