import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useProfileData } from "../../features/profile/hooks/useProfileData.js";
import { ProfileRatingCard } from "../../components/profile/ProfileRatingCard.jsx";

function sortRatings(ratings, sort) {
  const copies = [...ratings];
  if (sort === "oldest") {
    return copies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (sort === "rating_desc") {
    return copies.sort((a, b) => b.value - a.value || new Date(b.created_at) - new Date(a.created_at));
  } else if (sort === "rating_asc") {
    return copies.sort((a, b) => a.value - b.value || new Date(b.created_at) - new Date(a.created_at));
  } else if (sort === "release_desc") {
    return copies.sort((a, b) => {
      const dateA = a.movie?.release_date || a.show?.first_air_date || a.season?.air_date || a.episode?.air_date || "";
      const dateB = b.movie?.release_date || b.show?.first_air_date || b.season?.air_date || b.episode?.air_date || "";
      return dateB.localeCompare(dateA);
    });
  } else if (sort === "release_asc") {
    return copies.sort((a, b) => {
      const dateA = a.movie?.release_date || a.show?.first_air_date || a.season?.air_date || a.episode?.air_date || "";
      const dateB = b.movie?.release_date || b.show?.first_air_date || b.season?.air_date || b.episode?.air_date || "";
      return dateA.localeCompare(dateB);
    });
  }
  return copies;
}

function ProfileRatingsPage({ session }) {
  const { username } = useParams();
  const { profile, isOwn, canViewRatings, loading, notFound } = useProfileData(username, session);
  const [sort, setSort] = useState("newest");
  const [ratings, setRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  useEffect(() => {
    if (!canViewRatings || !profile?.id) {
      setRatings([]);
      return;
    }

    setRatingsLoading(true);
    supabase
      .from("user_rating")
      .select(`
        id, value, created_at,
        movie_id, show_id, season_id, episode_id,
        movie:movie_id(id, title, poster_path, release_date),
        show:show_id(id, name, poster_path, first_air_date),
        season:season_id(id, name, poster_path, air_date, show:show_id(id, name, poster_path)),
        episode:episode_id(id, name, air_date, season:season_id(id, show:show_id(id, name, poster_path)))
      `)
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        let sorted = data ?? [];
        if (sort !== "newest") {
          sorted = sortRatings(sorted, sort);
        }
        setRatings(sorted);
        setRatingsLoading(false);
      });
  }, [profile?.id, canViewRatings, sort]);

  const breadcrumbs = [{ label: username }];

  if (loading) {
    return (
      <AppLayout session={session} breadcrumbs={breadcrumbs}>
        <div className="mx-auto max-w-3xl animate-pulse space-y-4 pt-6">
          <div className="h-16 rounded-2xl bg-[#1a1f3a]" />
          <div className="h-32 rounded-2xl bg-[#1a1f3a]" />
        </div>
      </AppLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <AppLayout session={session}>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-lg font-semibold text-white">Profile not found</p>
          <p className="mt-1 text-sm text-[#5050a0]">@{username} doesn't exist.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead
        title={`${profile.username} — Ratings — watchpapa`}
        description={`${profile.username}'s ratings on watchpapa.`}
        path={`/u/${profile.username}/ratings`}
      />

      <div className="mx-auto max-w-3xl space-y-6 py-6 px-4 sm:px-0">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">
            {isOwn ? "Your" : `@${username}'s`} Ratings
          </h1>
          <p className="text-sm text-[#5050a0]">
            {ratings.length === 0 && !ratingsLoading ? "No ratings yet." : `${ratings.length} rating${ratings.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {!canViewRatings ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18] py-16 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5050a0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p className="mt-3 text-sm font-semibold text-white">This account is private</p>
            <p className="mt-1 text-xs text-[#5050a0]">
              Observe @{profile.username} to see their ratings once your request is accepted.
            </p>
          </div>
        ) : (
          <>
            {/* Sort controls */}
            <div className="flex items-center gap-3">
              <label htmlFor="sort-select" className="text-xs font-semibold text-[#8888c8] uppercase tracking-widest">Sort by</label>
              <select
                id="sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-lg border border-[#3a3a7a] bg-[#1a1d35] px-3 py-2 text-sm text-white transition hover:border-[#5a5aaa]"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="rating_desc">Rating: High → Low</option>
                <option value="rating_asc">Rating: Low → High</option>
                <option value="release_desc">Release: Newest first</option>
                <option value="release_asc">Release: Oldest first</option>
              </select>
            </div>

            {/* Ratings grid */}
            {ratings.length === 0 && !ratingsLoading && (
              <p className="text-sm text-[#4a4a7a]">No ratings yet.</p>
            )}

            {ratings.length > 0 && (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                {ratings.map((r) => <ProfileRatingCard key={r.id} rating={r} />)}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default ProfileRatingsPage;
