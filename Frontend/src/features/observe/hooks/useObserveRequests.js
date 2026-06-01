import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// Pending observe requests addressed to the current user (private accounts).
export function useObserveRequests(session) {
  const uid = session?.user?.id ?? null;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) { setRequests([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("user_observe")
      .select("observer_id, created_at, observer:observer_id(id, username, is_private)")
      .eq("observed_id", uid)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const respond = useCallback(async (observerId, accept) => {
    setRequests((prev) => prev.filter((r) => r.observer_id !== observerId));
    const { error } = await supabase.rpc("respond_observe_request", {
      p_observer_id: observerId,
      p_accept: accept,
    });
    if (error) load();
  }, [load]);

  return { requests, loading, respond, reload: load };
}
