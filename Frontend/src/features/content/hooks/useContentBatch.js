// Hydrate cards (title / poster / date / genres) for a set of user-data rows via
// POST /api/content/batch. Chunks the request, caches per-key across the app, and
// re-requests anything the server returned in `missing` (subrequest-budget spill).

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../lib/api.js";
import { cardKey } from "../lib/keys.js";
import { usePreferences } from "../../preferences/PreferencesContext.jsx";

const CHUNK = 18; // keep in step with the worker BATCH_MAX var
const cardCache = new Map(); // key -> card
const missingSeen = new Set(); // keys the server has said are 404 — don't re-fetch forever
const inflight = new Set(); // keys with a request in progress (any hook instance)
const listeners = new Set(); // mounted hook instances to re-render when the cache fills

function notify() {
  for (const fn of listeners) fn();
}

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

  // Re-render whenever any instance's request lands, so a fetch started by an
  // earlier effect run (or another component) still reaches this one.
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  useEffect(() => {
    const need = keyed.filter(
      ([k]) => !cardCache.has(lk(k)) && !missingSeen.has(lk(k)) && !inflight.has(lk(k)),
    );
    if (need.length === 0) return;
    for (const [k] of need) inflight.add(lk(k));

    // Chunks go out in parallel and each one renders as soon as it lands, so a
    // cold edge cache shows titles progressively instead of after the last chunk.
    for (const group of chunk(need, CHUNK)) {
      (async () => {
        try {
          const { cards, missing } = await apiFetch("/api/content/batch", {
            method: "POST",
            body: JSON.stringify({ items: group.map(([, it]) => it) }),
          });
          for (const [k, v] of Object.entries(cards ?? {})) cardCache.set(lk(k), v);
          // `missing` from the server = either a real 404 or budget spill. Retry
          // once by leaving it out of missingSeen only on the first pass; simplest
          // safe choice: mark 404-style keys seen so we don't loop.
          for (const k of missing ?? []) missingSeen.add(lk(k));
        } catch {
          // leave keys uncached — a later effect run retries
        } finally {
          for (const [k] of group) inflight.delete(lk(k));
          notify();
        }
      })();
    }
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
