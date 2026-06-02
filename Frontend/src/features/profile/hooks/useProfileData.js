import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// Fetches public profile data by username.
// Requires an authenticated session (profiles are login-gated).
export function useProfileData(username, session) {
  const [profile, setProfile] = useState(null);
  const [tier, setTier] = useState("free");
  const [favourites, setFavourites] = useState([]);
  const [isOwn, setIsOwn] = useState(false);
  const [canViewRatings, setCanViewRatings] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username || !session?.user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    supabase
      .from("profile")
      .select("id, username, bio, created_at, is_private, setting_allow_profile_share")
      .eq("username", username)
      .maybeSingle()
      .then(async ({ data: profileData }) => {
        if (cancelled) return;
        if (!profileData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const own = profileData.id === session.user.id;
        setProfile(profileData);
        setIsOwn(own);

        const [tierRes, favRes, viewRes] = await Promise.all([
          supabase.rpc("get_effective_tier", { p_profile_id: profileData.id }),
          supabase
            .from("profile_favourite")
            .select(`
              position,
              movie_id,
              show_id,
              movie:movie_id(id, title, poster_path, release_date),
              show:show_id(id, name, poster_path, first_air_date)
            `)
            .eq("profile_id", profileData.id)
            .order("position"),
          own
            ? Promise.resolve({ data: true })
            : supabase.rpc("can_view_ratings", { p_viewer: session.user.id, p_target: profileData.id }),
        ]);

        if (cancelled) return;
        setTier(tierRes.data ?? "free");
        setFavourites(favRes.data ?? []);
        setCanViewRatings(own ? true : (viewRes.data ?? false));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [username, session?.user?.id]);

  return { profile, tier, favourites, isOwn, canViewRatings, loading, notFound };
}
