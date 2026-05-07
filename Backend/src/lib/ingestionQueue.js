// Used by:
// - Backend/src/routes/inject.js
// - Backend/src/routes/resolve.js
const inflight = new Map();

// Deduplicate concurrent ingestion jobs to avoid duplicate database writes.
export function dedupIngest(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
