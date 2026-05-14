import { useEffect, useState } from "react";
import { adminFetch } from "../adminFetch.js";

export function useTierStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    adminFetch("/api/admin/stats/tiers")
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return { stats, loading, error, refresh: load };
}
