import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { isValidId } from "../../../lib/validate.js";

// Fetches the anonymous community rating stats for one content item.
// Uses the get_community_rating_stats RPC (SECURITY DEFINER) so that ratings
// from private accounts still count toward the aggregate even though per-user
// reads are gated by RLS. Returns histogram {1..10: count}, avg (1 decimal), total.
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
    setLoading(true);

    supabase
      .rpc("get_community_rating_stats", { p_media_type: mediaType, p_entity_id: id })
      .then(({ data }) => {
        if (cancelled) return;
        setLoading(false);
        const stats = data ?? {};
        const hist = stats.histogram ?? {};
        const t = stats.total ?? 0;
        setHistogram(hist);
        setTotal(t);
        setAvg(t > 0 && stats.avg != null ? Number(stats.avg) : null);
      });

    return () => { cancelled = true; };
  }, [mediaType, id]);

  return { histogram, avg, total, loading };
}
