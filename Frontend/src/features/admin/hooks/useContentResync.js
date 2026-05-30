import { useCallback, useState } from "react";
import { adminFetch } from "../adminFetch.js";

export function useContentSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = useCallback(async (q, type = "") => {
    if (!q || q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: q.trim() });
      if (type) params.set("type", type);
      const data = await adminFetch(`/api/admin/resync/search?${params}`);
      setResults(data.results ?? []);
    } catch (e) {
      setError(e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search };
}

export function useResync() {
  const [states, setStates] = useState({});

  const resync = useCallback(async (type, tmdbId, scope) => {
    const key = `${type}:${tmdbId}`;
    setStates((s) => ({ ...s, [key]: { loading: true, error: null, done: false } }));
    try {
      await adminFetch("/api/admin/resync", {
        method: "POST",
        body: JSON.stringify({ type, tmdbId, scope: scope ?? null }),
      });
      setStates((s) => ({ ...s, [key]: { loading: false, error: null, done: true } }));
    } catch (e) {
      setStates((s) => ({ ...s, [key]: { loading: false, error: e.message, done: false } }));
    }
  }, []);

  const getState = useCallback(
    (type, tmdbId) => states[`${type}:${tmdbId}`] ?? { loading: false, error: null, done: false },
    [states]
  );

  return { resync, getState };
}

export function useBulkResync() {
  const [bulkState, setBulkState] = useState({ loading: false, error: null, result: null });

  const bulkResync = useCallback(async (type, since) => {
    setBulkState({ loading: true, error: null, result: null });
    try {
      const data = await adminFetch("/api/admin/resync/bulk", {
        method: "POST",
        body: JSON.stringify({ type, since: since ?? null }),
      });
      setBulkState({ loading: false, error: null, result: data });
    } catch (e) {
      setBulkState({ loading: false, error: e.message, result: null });
    }
  }, []);

  return { bulkResync, bulkState };
}
