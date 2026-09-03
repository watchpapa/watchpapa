// Used by:
// - Frontend/src/pages/app/MoviesPage.jsx
import { useMediaBrowse } from "../../content/hooks/useMediaBrowse.js";

export function useMoviesPageData(session, showAdult = false) {
  return useMediaBrowse("movie", session, showAdult);
}
