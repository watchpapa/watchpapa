import { useCallback, useState } from "react";
import { adminFetch } from "../adminFetch.js";

export function useCatalogStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch("/api/admin/stats/catalog");
      setStats(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, refresh: load };
}
