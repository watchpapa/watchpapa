// Episode releases for followed shows in a given month, via POST /api/content/releases.
// Chunks the followed-show ids (the Worker bounds TMDB calls per request).
import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api.js";

const CHUNK = 12; // keep in step with the worker RELEASES_MAX_SHOWS var

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// showIds: number[] (TMDB ids), year, month (1-12)
export function useReleases(showIds, year, month) {
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(false);
  const key = `${[...showIds].sort().join(",")}|${year}|${month}`;

  useEffect(() => {
    if (showIds.length === 0 || !year || !month) {
      setEntries({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const merged = {};
      try {
        for (const group of chunk(showIds, CHUNK)) {
          const { entries: e } = await apiFetch("/api/content/releases", {
            method: "POST",
            body: JSON.stringify({ showIds: group, year, month }),
          });
          if (cancelled) return;
          for (const [date, list] of Object.entries(e ?? {})) {
            merged[date] = [...(merged[date] ?? []), ...list];
          }
        }
        if (!cancelled) setEntries(merged);
      } catch {
        if (!cancelled) setEntries({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { entries, loading };
}
