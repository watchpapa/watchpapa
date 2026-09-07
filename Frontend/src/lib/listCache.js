// In-memory snapshots of list/browse page data, so pressing Back restores the
// page (loaded pages, counters, scroll target) instead of refetching page 1.
//
// Same idea as features/content/hooks/useContent.js's module cache, generalised.
// In-memory only — no serialization, so Sets and nested objects survive as-is,
// and a hard reload naturally starts fresh.
//
// Usage in a data hook:
//   const key = listKey("browse:movie", { uid, showAdult, localeKey });
//   const seed = readList(key);                       // undefined | snapshot
//   const [cards, setCards] = useState(() => seed?.cards ?? []);
//   ...
//   useEffect(() => {                                 // hydrate-or-fetch on key change
//     const warm = readList(key);
//     if (warm) { setCards(warm.cards); ...; setLoading(false); return; }
//     // ...existing fetch...
//   }, [key]);
//   useEffect(() => {                                 // write-through
//     if (loading) return;
//     writeList(key, { cards, ... });
//   }, [key, loading, cards, ...]);

const store = new Map(); // key -> { at:number, data:object }
const DEFAULT_TTL = 5 * 60 * 1000;
const MAX_ENTRIES = 40;

// Build a stable cache key. Every value that changes the fetched result must be
// in `params` (uid, showAdult, localeKey, providers, region, route filters…).
export function listKey(name, params = {}) {
  const norm = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k] ?? ""}`)
    .join("&");
  return norm ? `${name}?${norm}` : name;
}

export function readList(key, ttl = DEFAULT_TTL) {
  if (!key) return undefined;
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > ttl) {
    store.delete(key);
    return undefined;
  }
  return hit.data;
}

export function writeList(key, data) {
  if (!key) return;
  store.set(key, { at: Date.now(), data });
  if (store.size > MAX_ENTRIES) {
    store.delete(store.keys().next().value); // drop oldest (insertion order)
  }
}

// Drop cached snapshots after a mutation that would make them stale. `prefix`
// null clears everything; otherwise clears keys that start with it
// (e.g. invalidateList("browse:") after a follow toggle on a detail page).
export function invalidateList(prefix) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
