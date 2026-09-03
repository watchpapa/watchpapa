// Used by:
// - Frontend/src/pages/app/ShowsPage.jsx
import { useMediaBrowse } from "../../content/hooks/useMediaBrowse.js";

export function useShowsPageData(session, showAdult = false) {
  return useMediaBrowse("show", session, showAdult);
}
