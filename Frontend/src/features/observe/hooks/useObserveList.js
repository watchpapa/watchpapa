import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// Loads a profile's observers or observing list via RPC (gated for private
// accounts). kind: 'observers' | 'observing'.
export function useObserveList(profileId, kind) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) { setList([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const fn = kind === "observers" ? "get_observers" : "get_observing";
    supabase
      .rpc(fn, { p_profile_id: profileId })
      .then(({ data }) => {
        if (cancelled) return;
        setList(data ?? []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [profileId, kind]);

  return { list, loading };
}
