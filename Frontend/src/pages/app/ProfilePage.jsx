import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import SectionTitle from "../../components/ui/SectionTitle.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { useProfileData } from "../../features/profile/hooks/useProfileData.js";
import { useProfileRatings } from "../../features/profile/hooks/useProfileRatings.js";
import { useProfileStats } from "../../features/profile/hooks/useProfileStats.js";
import { useObserve } from "../../features/observe/hooks/useObserve.js";
import { useObserveCounts } from "../../features/observe/hooks/useObserveCounts.js";
import { ProfileFavourites } from "../../components/profile/ProfileFavourites.jsx";
import { ProfileStats } from "../../components/profile/ProfileStats.jsx";
import { ProfileRatingCard } from "../../components/profile/ProfileRatingCard.jsx";
import ProfileShareModal from "../../components/profile/ProfileShareModal.jsx";
import { TIER_BADGE_VARIANTS, tierLabel } from "../../lib/tierMeta.js";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { EditIcon, LockIcon, SettingsIcon, ShareIcon, UserIcon } from "../../components/icons/index.jsx";

// Observe + block controls shown on another user's profile.
function ObserveControls({ targetId, targetIsPrivate, session, onChange }) {
  const { status, isBlocked, loading, busy, observe, unobserve, block, unblock } = useObserve(targetId, session);

  if (loading) return <Skeleton className="h-9 w-28 rounded-xl" />;
  const afterChange = () => onChange?.();

  if (isBlocked) {
    return <Button variant="secondary" size="sm" onClick={async () => { await unblock(); afterChange(); }} loading={busy}>Unblock</Button>;
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
    <>
      {status === "accepted" ? (
        <Button variant="success" size="sm" onClick={handleObserve} loading={busy} title="Unobserve">✓ Observing</Button>
      ) : status === "pending" ? (
        <Button variant="secondary" size="sm" onClick={handleObserve} loading={busy} title="Cancel request">Requested</Button>
      ) : (
        <Button size="sm" onClick={handleObserve} loading={busy}>{targetIsPrivate ? "Request to observe" : "Observe"}</Button>
      )}
      <Button variant="outline" size="sm" onClick={handleBlock} disabled={busy}>Block</Button>
    </>
  );
}

function ProfilePage({ session }) {
  const { username } = useParams();
  const { profile, tier, favourites, isOwn, canViewRatings, loading, notFound } = useProfileData(username, session);
  const [twoWeeksAgo] = useState(() => new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
  const { ratings, loading: ratingsLoading } = useProfileRatings(canViewRatings ? profile?.id : null, { since: twoWeeksAgo });
  const { basic, genreStats, decadeStats, monthlyStats } = useProfileStats(canViewRatings ? profile?.id : null, tier);
  const { counts, reload: reloadCounts } = useObserveCounts(profile?.id);
  const [shareOpen, setShareOpen] = useState(false);

  const breadcrumbs = [{ label: username }];

  if (loading) {
    return (
      <AppLayout session={session} breadcrumbs={breadcrumbs}>
        <PageContainer width="standard" className="space-y-4">
          <Skeleton className="h-36 rounded-3xl sm:h-44" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </PageContainer>
      </AppLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <AppLayout session={session}>
        <EmptyState icon={UserIcon} title="Profile not found" description={`@${username} doesn't exist.`} />
      </AppLayout>
    );
  }

  // Banner: the first favourite's poster, blurred — or a brand gradient.
  const firstFav = favourites.find((f) => f.position === 1) ?? favourites[0];
  const bannerPoster = firstFav ? (firstFav.movie ?? firstFav.show)?.poster_path : null;
  const canShare = isOwn || profile?.setting_allow_profile_share;
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead title={`${profile.username} — watchpapa`} description={profile.bio ?? `${profile.username}'s profile on watchpapa.`} path={`/u/${profile.username}`} />

      <PageContainer width="standard" className="space-y-6">
        {/* Header: banner + overlapping avatar */}
        <header className="rounded-3xl border border-border/50 bg-surface">
          <div className="relative h-32 overflow-hidden rounded-t-3xl sm:h-44">
            {bannerPoster ? (
              <img src={tmdbImg(bannerPoster, "w500")} alt="" className="h-full w-full scale-110 object-cover object-top opacity-60 blur-md" aria-hidden />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-brand-deep via-[#1f1a55] to-accent/40" aria-hidden />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
          </div>

          {/* relative z-10: the banner above is positioned, so without this the
              overlapping avatar + name would paint underneath it. */}
          <div className="relative z-10 px-4 pb-5 sm:px-6">
            <div className="-mt-12 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <Avatar
                  username={profile.username}
                  avatarType={profile.avatar_type}
                  avatarPosterPath={profile.avatar_poster_path}
                  avatarUploadPath={profile.avatar_upload_path}
                  size="xl"
                  className="border-surface shadow-xl sm:h-32 sm:w-32 sm:text-5xl"
                />
                <div className="min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-extrabold text-white sm:text-3xl">{profile.username}</h1>
                    <Badge variant={TIER_BADGE_VARIANTS[tier] ?? "neutral"} size="sm">{tierLabel(tier)}</Badge>
                    {profile.is_private && <Badge size="sm"><LockIcon size={11} /> Private</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-text-faint">Member since {memberSince}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:justify-end">
                {canShare && <Button variant="secondary" size="sm" icon={ShareIcon} onClick={() => setShareOpen(true)}>Share</Button>}
                {isOwn ? (
                  <>
                    <Button to="/profile/edit" variant="secondary" size="sm" icon={EditIcon}>Edit profile</Button>
                    <Button to="/settings" variant="outline" size="sm" icon={SettingsIcon} aria-label="Settings">Settings</Button>
                  </>
                ) : (
                  <ObserveControls targetId={profile.id} targetIsPrivate={profile.is_private} session={session} onChange={reloadCounts} />
                )}
              </div>
            </div>

            {profile.bio && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text">{profile.bio}</p>}

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <Link to={`/u/${profile.username}/observers`} className="text-text-muted transition hover:text-white">
                <span className="font-bold text-white">{counts.observers}</span> Observers
              </Link>
              <Link to={`/u/${profile.username}/observing`} className="text-text-muted transition hover:text-white">
                <span className="font-bold text-white">{counts.observing}</span> Observing
              </Link>
              {canViewRatings && basic?.total != null && (
                <Link to={`/u/${profile.username}/ratings`} className="text-text-muted transition hover:text-white">
                  <span className="font-bold text-white">{basic.total}</span> Ratings
                </Link>
              )}
            </div>
          </div>
        </header>

        {favourites.length > 0 && <ProfileFavourites favourites={favourites} isOwn={isOwn} username={profile.username} />}

        {!canViewRatings ? (
          <EmptyState icon={LockIcon} title="This account is private" description={`Observe @${profile.username} to see their ratings and stats once your request is accepted.`} className="rounded-2xl border border-border/50 bg-surface" />
        ) : (
          <>
            <ProfileStats profileId={profile.id} basic={basic} genreStats={genreStats} decadeStats={decadeStats} monthlyStats={monthlyStats} ownerTier={tier} isOwn={isOwn} username={profile.username} />

            <section>
              <SectionTitle action={<Button to={`/u/${profile.username}/ratings`} variant="ghost" size="xs">See all →</Button>}>
                {isOwn ? "Your recent ratings" : "Recent ratings"}
              </SectionTitle>
              {ratings.length === 0 && !ratingsLoading ? (
                <EmptyState compact title="No ratings in the last 2 weeks." />
              ) : (
                <div className="grid grid-cols-3 gap-3 xs:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                  {ratings.map((r) => <ProfileRatingCard key={r.id} rating={r} />)}
                </div>
              )}
            </section>
          </>
        )}
      </PageContainer>

      {shareOpen && canShare && (
        <ProfileShareModal onClose={() => setShareOpen(false)} profile={profile} tier={tier} favourites={favourites} basic={basic} genreStats={genreStats} decadeStats={decadeStats} ownerTier={tier} />
      )}
    </AppLayout>
  );
}

export default ProfilePage;
