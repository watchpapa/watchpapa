import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

export function useShowFollow(rawShowId, session) {
  const showId = rawShowId ? parseInt(rawShowId, 10) : null;
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!showId || !session?.user?.id) {
      setIsFollowing(false);
      return;
    }
    let cancelled = false;

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

  const toggleFollow = useCallback(async () => {
    if (!session?.user?.id || !showId) return;
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
