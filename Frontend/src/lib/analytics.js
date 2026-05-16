import { supabase } from "./supabase.js";
import { hasAccepted } from "./cookieConsent.js";

export function trackPresence() {
  if (!hasAccepted()) return;
  supabase.rpc("track_presence").then(() => {});
}

export function trackPageView(page) {
  if (!hasAccepted()) return;
  supabase.rpc("track_page_view", { p_page: page }).then(() => {});
}

export function trackContentClick(contentType, contentId, genreIds = [], source = "browse") {
  if (!hasAccepted()) return;
  supabase
    .rpc("track_content_click", {
      p_content_type: contentType,
      p_content_id: contentId,
      p_genre_ids: genreIds.length > 0 ? genreIds : null,
      p_source: source,
    })
    .then(() => {});
}
