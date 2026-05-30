import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// Calls get_limit_status RPC and computes whether the user is over any limit.
// Used to conditionally show OverLimitBanner on /follows and /watchlists.
export function useOverageStatus(session, refreshKey = 0) {
  const uid = session?.user?.id;
  const [status, setStatus] = useState(null);
  const [isOverFollowLimit, setIsOverFollowLimit] = useState(false);
  const [isOverWatchlistLimit, setIsOverWatchlistLimit] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setLoading(true);

    supabase.rpc("get_limit_status", { p_profile_id: uid }).then(({ data }) => {
      if (cancelled || !data) return;
      setStatus(data);
      setLoading(false);

      const showOver = data.show_limit !== null && data.show_follows > data.show_limit;
      const movieOver = data.movie_limit !== null && data.movie_follows > data.movie_limit;
      // Premium has combined limit
      const combinedOver =
        data.combined_limit !== null &&
        data.show_follows + data.movie_follows > data.combined_limit;
      setIsOverFollowLimit(showOver || movieOver || combinedOver);

      const watchlistOver =
        data.watchlist_limit !== null && data.watchlist_count > data.watchlist_limit;
      setIsOverWatchlistLimit(watchlistOver);
    });

    return () => { cancelled = true; };
  }, [uid, refreshKey]);

  return { status, isOverFollowLimit, isOverWatchlistLimit, loading };
}
