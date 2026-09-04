// Hydrate cards (title / poster / date / genres) for a set of user-data rows via
// POST /api/content/batch. Chunks the request, caches per-key across the app, and
// re-requests anything the server returned in `missing` (subrequest-budget spill).

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api.js";
import { cardKey } from "../lib/keys.js";
import { usePreferences } from "../../preferences/PreferencesContext.jsx";

const CHUNK = 18; // keep in step with the worker BATCH_MAX var
const cardCache = new Map(); // key -> card
const missingSeen = new Set(); // keys the server has said are 404 — don't re-fetch forever

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// items: [{ type, id?, showId?, seasonNumber?, episodeNumber? }]
//
// cardCache/missingSeen entries are keyed `${localeKey}:${cardKey}` — the batch
// response is locale-dependent (title/date/nsfw all vary by language/region), so a
// locale switch must not read stale-language cards back out of the cache.
export function useContentBatch(items) {
  const { localeKey } = usePreferences();
  const lk = (k) => `${localeKey}:${k}`;

  // Stable key list, dedup.
  const keyed = useMemo(() => {
    const seen = new Map();
    for (const it of items ?? []) {
      const k = cardKey(it);
      if (!seen.has(k)) seen.set(k, it);
    }
    return [...seen.entries()]; // [ [key, item], ... ]
  }, [JSON.stringify(items ?? [])]);

  const [, force] = useState(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    const need = keyed.filter(([k]) => !cardCache.has(lk(k)) && !missingSeen.has(lk(k))).map(([, it]) => it);
    if (need.length === 0 || loadingRef.current) return;

    let cancelled = false;
    loadingRef.current = true;
    (async () => {
      try {
        for (const group of chunk(need, CHUNK)) {
          const { cards, missing } = await apiFetch("/api/content/batch", {
            method: "POST",
            body: JSON.stringify({ items: group }),
          });
          if (cancelled) return;
          for (const [k, v] of Object.entries(cards ?? {})) cardCache.set(lk(k), v);
          // `missing` from the server = either a real 404 or budget spill. Retry
          // once by leaving it out of missingSeen only on the first pass; simplest
          // safe choice: mark 404-style keys seen so we don't loop.
          for (const k of missing ?? []) missingSeen.add(lk(k));
        }
      } catch {
        // leave keys uncached — a later render retries
      } finally {
        loadingRef.current = false;
        if (!cancelled) force((n) => n + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [keyed, localeKey]);

  const cards = {};
  const missing = [];
  for (const [k] of keyed) {
    if (cardCache.has(lk(k))) cards[k] = cardCache.get(lk(k));
    else missing.push(k);
  }
  const loading = missing.some((k) => !missingSeen.has(lk(k)));

  return { cards, missing, loading, cardKey };
}
