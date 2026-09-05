import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { useContentBatch } from "../../content/hooks/useContentBatch.js";
import { cardKey } from "../../content/lib/keys.js";

// Public profile data by username. Favourites hold (media_type, tmdb_id); their
// movie/show metadata is hydrated from the Worker.
export function useProfileData(username, session) {
  const [profile, setProfile] = useState(null);
  const [tier, setTier] = useState("free");
  const [favRows, setFavRows] = useState([]); // [{ position, media_type, tmdb_id }]
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
      .select("id, username, bio, created_at, is_private, setting_allow_profile_share, avatar_type, avatar_poster_path, avatar_upload_path, banner_favourite_position, banner_crop")
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
            .select("position, media_type, tmdb_id")
            .eq("profile_id", profileData.id)
            .order("position"),
          own
            ? Promise.resolve({ data: true })
            : supabase.rpc("can_view_ratings", { p_viewer: session.user.id, p_target: profileData.id }),
        ]);
        if (cancelled) return;
        setTier(tierRes.data ?? "free");
        setFavRows((favRes.data ?? []).map((r) => ({ ...r, tmdb_id: Number(r.tmdb_id) })));
        setCanViewRatings(own ? true : (viewRes.data ?? false));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, session?.user?.id]);

  const { cards, loading: cardsLoading } = useContentBatch(
    useMemo(() => favRows.map((r) => ({ type: r.media_type, id: r.tmdb_id })), [favRows]),
  );

  const favourites = useMemo(
    () =>
      favRows.map((r) => {
        const c = cards[cardKey({ type: r.media_type, id: r.tmdb_id })];
        const media = c
          ? { id: r.tmdb_id, title: c.title, name: c.title, poster_path: c.poster_path, backdrop_path: c.backdrop_path ?? null, release_date: c.date, first_air_date: c.date }
          : null;
        return {
          position: r.position,
          media_type: r.media_type,
          tmdb_id: r.tmdb_id,
          movie_id: r.media_type === "movie" ? r.tmdb_id : null,
          show_id: r.media_type === "show" ? r.tmdb_id : null,
          movie: r.media_type === "movie" ? media : null,
          show: r.media_type === "show" ? media : null,
        };
      }),
    [favRows, cards],
  );

  return { profile, tier, favourites, isOwn, canViewRatings, loading: loading || cardsLoading, notFound };
}
