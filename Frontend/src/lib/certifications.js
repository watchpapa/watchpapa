// Looks up the human-readable meaning of a per-title certification code (e.g.
// "PG-13") against the catalog from GET /api/content/certifications
// ({ movie: { US: [{certification, meaning, order}], ... }, tv: {...} }).
export function certificationMeaning(catalog, kind, region, code) {
  if (!catalog || !region || !code) return null;
  const list = catalog[kind]?.[region];
  if (!Array.isArray(list)) return null;
  return list.find((c) => c.certification === code)?.meaning || null;
}
