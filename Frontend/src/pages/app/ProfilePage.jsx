import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useProfileData } from "../../features/profile/hooks/useProfileData.js";
import { useProfileRatings } from "../../features/profile/hooks/useProfileRatings.js";
import { ProfileFavourites } from "../../components/profile/ProfileFavourites.jsx";
import { ProfileStats } from "../../components/profile/ProfileStats.jsx";
import { ProfileRatingCard } from "../../components/profile/ProfileRatingCard.jsx";

const TIER_COLORS = {
  free: "text-green-400 border-green-900/50 bg-green-900/10",
  premium: "text-amber-400 border-amber-900/50 bg-amber-900/10",
  pro: "text-sky-400 border-sky-900/50 bg-sky-900/10",
  pro_plus: "text-violet-400 border-violet-900/50 bg-violet-900/10",
  god: "text-rose-400 border-rose-900/50 bg-rose-900/10",
};
const TIER_LABELS = { free: "Free", premium: "Premium", pro: "Pro", pro_plus: "Pro+", god: "God" };

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function MemberSince({ date }) {
  const d = new Date(date);
  return (
    <span className="text-xs text-[#5050a0]">
      Member since {d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
    </span>
  );
}

function ProfilePage({ session }) {
  const { username } = useParams();
  const { profile, tier, favourites, isOwn, loading, notFound } = useProfileData(username, session);
  const { ratings, loading: ratingsLoading, hasMore, loadMore } = useProfileRatings(profile?.id);

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

  const initials = (profile.username?.[0] ?? "?").toUpperCase();

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead
        title={`${profile.username} — watchpapa`}
        description={profile.bio ?? `${profile.username}'s profile on watchpapa.`}
        path={`/u/${profile.username}`}
      />

      <div className="mx-auto max-w-3xl space-y-6 py-6 px-4 sm:px-0">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-[#3a3a7a] bg-[#1a1d35] text-2xl font-bold text-[#a0a0e8]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-white">{profile.username}</h1>
              <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${TIER_COLORS[tier] ?? TIER_COLORS.free}`}>
                {TIER_LABELS[tier] ?? tier}
              </span>
              {isOwn && (
                <div className="ml-auto flex items-center gap-2">
                  <Link
                    to="/profile/edit"
                    className="rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white"
                  >
                    Edit Profile
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center gap-1.5 rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-2.5 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white"
                    title="Settings"
                  >
                    <GearIcon />
                  </Link>
                </div>
              )}
            </div>
            {profile.bio && (
              <p className="mt-1 text-sm text-[#a0a0d8]">{profile.bio}</p>
            )}
            <div className="mt-1">
              <MemberSince date={profile.created_at} />
            </div>
          </div>
        </div>

        {/* Favourites */}
        {favourites.length > 0 && <ProfileFavourites favourites={favourites} />}

        {/* Stats */}
        <ProfileStats profileId={profile.id} ownerTier={tier} />

        {/* Ratings grid */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#5050b0]">
            Ratings {ratings.length > 0 && <span className="normal-case text-[#4a4a7a]">({ratings.length}{hasMore ? "+" : ""})</span>}
          </h2>

          {ratings.length === 0 && !ratingsLoading && (
            <p className="text-sm text-[#4a4a7a]">No ratings yet.</p>
          )}

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {ratings.map((r) => <ProfileRatingCard key={r.id} rating={r} />)}
          </div>

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={ratingsLoading}
              className="mt-4 w-full rounded-xl border border-[#2a2f5a] py-2.5 text-sm font-semibold text-[#8383e7] transition hover:border-[#5a5aaa] hover:text-white disabled:opacity-50"
            >
              {ratingsLoading ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default ProfilePage;
