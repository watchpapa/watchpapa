import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function fetchEarlyAdopterStats() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;

  const res = await fetch(`${API_BASE}/api/admin/stats/early-adopters`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function useEarlyAdopterStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchEarlyAdopterStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function refresh() {
    setLoading(true);
    setError(null);
    fetchEarlyAdopterStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  return { stats, loading, error, refresh };
}
