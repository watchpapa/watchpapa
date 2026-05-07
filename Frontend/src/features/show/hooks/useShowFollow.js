// Used by:
// - Frontend/src/pages/app/EpisodePage.jsx
// - Frontend/src/pages/app/SeasonPage.jsx
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { isValidId } from "../../../lib/validate.js";

// Load and toggle the current user's follow state for a show.
export function useShowFollow(rawShowId, session) {
  const showId = rawShowId ? parseInt(rawShowId, 10) : null;
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!showId || !session?.user?.id) {
      setIsFollowing(false);
      return;
    }
    let cancelled = false;

    // Read follow state from user_followed_shows for this user/show pair.
    supabase
      .from("user_followed_shows")
      .select("id")
      .eq("profile_id", session.user.id)
      .eq("show_id", showId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsFollowing(!!data);
      });

    return () => { cancelled = true; };
  }, [showId, session?.user?.id]);

  // Write follow/unfollow changes to user_followed_shows.
  const toggleFollow = useCallback(async () => {
    if (!session?.user?.id || !isValidId(showId)) return;
    const was = isFollowing;
    setIsFollowing(!was);

    const { error } = was
      ? await supabase
          .from("user_followed_shows")
          .delete()
          .eq("profile_id", session.user.id)
          .eq("show_id", showId)
      : await supabase
          .from("user_followed_shows")
          .insert({ profile_id: session.user.id, show_id: showId });

    if (error) setIsFollowing(was);
  }, [showId, session?.user?.id, isFollowing]);

  return { isFollowing, toggleFollow };
}
