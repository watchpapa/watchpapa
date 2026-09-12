// Mirrors the frontend's filmKey() (Frontend/src/pages/app/ImportPage.jsx) —
// must stay identical so a film resolved server-side maps back to the same
// ratings/watchlist source rows the client sent.
export function filmKey(item) {
  return item.uri?.trim().toLowerCase() || `${item.name.toLowerCase()}|||${item.year}`;
}
