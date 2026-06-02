import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useProfileData } from "../../features/profile/hooks/useProfileData.js";
import { useProfileRatings } from "../../features/profile/hooks/useProfileRatings.js";
import { useProfileStats } from "../../features/profile/hooks/useProfileStats.js";
import { useObserve } from "../../features/observe/hooks/useObserve.js";
import { useObserveCounts } from "../../features/observe/hooks/useObserveCounts.js";
import { ProfileFavourites } from "../../components/profile/ProfileFavourites.jsx";
import { ProfileStats } from "../../components/profile/ProfileStats.jsx";
import { ProfileRatingCard } from "../../components/profile/ProfileRatingCard.jsx";
import ProfileShareModal from "../../components/profile/ProfileShareModal.jsx";

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

// Observe + block controls shown on another user's profile.
function ObserveControls({ targetId, targetIsPrivate, session, onChange }) {
  const { status, isBlocked, loading, busy, observe, unobserve, block, unblock } = useObserve(targetId, session);
  const [hover, setHover] = useState(false);

  if (loading) return <div className="h-8 w-24 animate-pulse rounded-xl bg-[#1a1f3a]" />;

  const afterChange = () => onChange?.();

  if (isBlocked) {
    return (
      <button
        onClick={async () => { await unblock(); afterChange(); }}
        disabled={busy}
        className="rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-4 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white disabled:opacity-50"
      >
        Unblock
      </button>
    );
  }

  let label;
  let primary = false;
  if (status === "accepted") {
    label = hover ? "Unobserve" : "Observing";
  } else if (status === "pending") {
    label = hover ? "Cancel request" : "Requested";
  } else {
    label = targetIsPrivate ? "Request to observe" : "Observe";
    primary = true;
  }

  const handleObserve = async () => {
    if (status === "accepted" || status === "pending") await unobserve();
    else await observe();
    afterChange();
  };

  const handleBlock = async () => {
    if (!window.confirm("Block this user? Any observe relationship between you will be removed.")) return;
    await block();
    afterChange();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleObserve}
        disabled={busy}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
          primary
            ? "border border-[#7070d0] bg-[#3a3a8a] text-white hover:bg-[#4a4aaa]"
            : "border border-[#3a3a7a] bg-[#1a1d35] text-[#a0a0e8] hover:border-[#aa5a5a] hover:text-white"
        }`}
      >
        {label}
      </button>
      <button
        onClick={handleBlock}
        disabled={busy}
        title="Block user"
        className="rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1.5 text-xs font-semibold text-[#8888c8] transition hover:border-[#aa5a5a] hover:text-white disabled:opacity-50"
      >
        Block
      </button>
    </div>
  );
}

function ProfilePage({ session }) {
  const { username } = useParams();
  const { profile, tier, favourites, isOwn, canViewRatings, loading, notFound } = useProfileData(username, session);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { ratings, loading: ratingsLoading, hasMore, loadMore } = useProfileRatings(canViewRatings ? profile?.id : null, { since: twoWeeksAgo });
  const { basic, genreStats, decadeStats, monthlyStats } = useProfileStats(canViewRatings ? profile?.id : null, tier);
  const { counts, reload: reloadCounts } = useObserveCounts(profile?.id);
  const [shareOpen, setShareOpen] = useState(false);

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
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-white">{profile.username}</h1>
              <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${TIER_COLORS[tier] ?? TIER_COLORS.free}`}>
                {TIER_LABELS[tier] ?? tier}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(isOwn || profile?.setting_allow_profile_share) && (
                <button
                  onClick={() => setShareOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white"
                  aria-label="Share profile"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Share
                </button>
              )}
              {isOwn ? (
                <>
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
                    aria-label="Settings"
                  >
                    <GearIcon />
                  </Link>
                </>
              ) : (
                <ObserveControls
                  targetId={profile.id}
                  targetIsPrivate={profile.is_private}
                  session={session}
                  onChange={reloadCounts}
                />
              )}
            </div>

            {/* Observer / observing counts */}
            <div className="flex items-center gap-4 text-xs">
              <Link to={`/u/${profile.username}/observers`} className="text-[#8888c8] transition hover:text-white">
                <span className="font-bold text-white">{counts.observers}</span> Observers
              </Link>
              <Link to={`/u/${profile.username}/observing`} className="text-[#8888c8] transition hover:text-white">
                <span className="font-bold text-white">{counts.observing}</span> Observing
              </Link>
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
        {favourites.length > 0 && <ProfileFavourites favourites={favourites} isOwn={isOwn} username={profile.username} />}

        {!canViewRatings ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18] py-16 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5050a0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p className="mt-3 text-sm font-semibold text-white">This account is private</p>
            <p className="mt-1 text-xs text-[#5050a0]">
              Observe @{profile.username} to see their ratings and stats once your request is accepted.
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <ProfileStats
              profileId={profile.id}
              basic={basic}
              genreStats={genreStats}
              decadeStats={decadeStats}
              monthlyStats={monthlyStats}
              ownerTier={tier}
              isOwn={isOwn}
              username={profile.username}
            />

            {/* Recent Ratings */}
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#c084fc]">
                {isOwn ? "Your" : `@${username}`} Recent Ratings
              </h2>

              {ratings.length === 0 && !ratingsLoading && (
                <p className="text-sm text-[#4a4a7a]">No ratings in the last 2 weeks.</p>
              )}

              {ratings.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {ratings.map((r) => <ProfileRatingCard key={r.id} rating={r} />)}
                </div>
              )}

              <Link
                to={`/u/${profile.username}/ratings`}
                className="mt-4 block w-full rounded-xl border border-[#2a2f5a] py-2.5 text-center text-sm font-semibold text-[#8383e7] transition hover:border-[#5a5aaa] hover:text-white"
              >
                See all ratings →
              </Link>
            </div>
          </>
        )}
      </div>
      {shareOpen && (isOwn || profile?.setting_allow_profile_share) && (
        <ProfileShareModal
          onClose={() => setShareOpen(false)}
          profile={profile}
          tier={tier}
          favourites={favourites}
          basic={basic}
          genreStats={genreStats}
          decadeStats={decadeStats}
          ownerTier={tier}
        />
      )}
    </AppLayout>
  );
}

export default ProfilePage;
