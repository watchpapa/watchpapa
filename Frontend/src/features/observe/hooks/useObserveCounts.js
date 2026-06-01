import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// Observer / observing counts for a profile. Counts are public even for
// private accounts (only the lists themselves are gated).
export function useObserveCounts(profileId) {
  const [counts, setCounts] = useState({ observers: 0, observing: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    const { data } = await supabase.rpc("get_observe_counts", { p_profile_id: profileId });
    setCounts({
      observers: data?.observers ?? 0,
      observing: data?.observing ?? 0,
    });
    setLoading(false);
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  return { counts, loading, reload: load };
}
