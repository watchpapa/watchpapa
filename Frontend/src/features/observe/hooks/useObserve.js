import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// Manages the current user's observe / block relationship toward one target
// profile. status: 'accepted' | 'pending' | null. isBlocked: you blocked them.
export function useObserve(targetId, session) {
  const uid = session?.user?.id ?? null;
  const isSelf = !!uid && uid === targetId;
  const [status, setStatus] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!uid || !targetId || isSelf) {
      setStatus(null);
      setIsBlocked(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [observeRes, blockRes] = await Promise.all([
      supabase
        .from("user_observe")
        .select("status")
        .eq("observer_id", uid)
        .eq("observed_id", targetId)
        .maybeSingle(),
      supabase
        .from("user_block")
        .select("id")
        .eq("blocker_id", uid)
        .eq("blocked_id", targetId)
        .maybeSingle(),
    ]);
    setStatus(observeRes.data?.status ?? null);
    setIsBlocked(!!blockRes.data);
    setLoading(false);
  }, [uid, targetId, isSelf]);

  useEffect(() => { load(); }, [load]);

  const observe = useCallback(async () => {
    if (!uid || !targetId || isSelf || busy) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("user_observe")
      .insert({ observer_id: uid, observed_id: targetId })
      .select("status")
      .single();
    setBusy(false);
    if (!error && data) setStatus(data.status);
    return { error };
  }, [uid, targetId, isSelf, busy]);

  const unobserve = useCallback(async () => {
    if (!uid || !targetId || busy) return;
    setBusy(true);
    const prev = status;
    setStatus(null);
    const { error } = await supabase
      .from("user_observe")
      .delete()
      .eq("observer_id", uid)
      .eq("observed_id", targetId);
    setBusy(false);
    if (error) setStatus(prev);
  }, [uid, targetId, status, busy]);

  const block = useCallback(async () => {
    if (!uid || !targetId || isSelf || busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("user_block")
      .insert({ blocker_id: uid, blocked_id: targetId });
    setBusy(false);
    if (!error) {
      setIsBlocked(true);
      setStatus(null);
    }
    return { error };
  }, [uid, targetId, isSelf, busy]);

  const unblock = useCallback(async () => {
    if (!uid || !targetId || busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("user_block")
      .delete()
      .eq("blocker_id", uid)
      .eq("blocked_id", targetId);
    setBusy(false);
    if (!error) setIsBlocked(false);
  }, [uid, targetId, busy]);

  return { status, isBlocked, loading, busy, observe, unobserve, block, unblock, reload: load };
}
