import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { isValidId } from "../../../lib/validate.js";

// Ratings for one entity from the people the current user observes.
// Used by the detail-page "people you observe" panel.
export function useObservedRatings(mediaType, entityId, session) {
  const id = entityId ? parseInt(entityId, 10) : null;
  const uid = session?.user?.id ?? null;
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid || !id || !mediaType || !isValidId(id)) {
      setRatings([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    supabase
      .rpc("get_observed_ratings_for_entity", { p_media_type: mediaType, p_entity_id: id })
      .then(({ data }) => {
        if (cancelled) return;
        setLoading(false);
        setRatings(data ?? []);
      });

    return () => { cancelled = true; };
  }, [mediaType, id, uid]);

  const avg = ratings.length
    ? Math.round((ratings.reduce((s, r) => s + r.value, 0) / ratings.length) * 10) / 10
    : null;

  return { ratings, avg, total: ratings.length, loading };
}
