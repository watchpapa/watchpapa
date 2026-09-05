import { supabase } from "../../../lib/supabase.js";
import { resolveWatchTarget } from "./watchTarget.js";

// Rating something implies you've watched it — log the first watch event
// (dated today) the first time a title gets rated, so the "watched" state
// shown on Movie/ShowPage (features/watchlist/hooks/useWatchLog.js) has a
// real date behind it instead of only an inferred flag. Only seeds once: if
// a log entry already exists (from an earlier rating, or the user logging
// watches directly), this is a no-op.
export async function ensureWatchLogSeed(mediaType, tmdbId, tmdbShowId, profileId) {
  const target = resolveWatchTarget(mediaType, tmdbId, tmdbShowId);
  if (!target || !profileId) return;

  const { count } = await supabase
    .from("watch_log")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("media_type", target.mediaType)
    .eq("tmdb_id", target.tmdbId);
  if (count) return;

  await supabase.from("watch_log").insert({
    profile_id: profileId,
    media_type: target.mediaType,
    tmdb_id: target.tmdbId,
  });
}
