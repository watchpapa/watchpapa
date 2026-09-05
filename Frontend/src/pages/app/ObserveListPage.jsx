import { useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { useProfileData } from "../../features/profile/hooks/useProfileData.js";
import { useObserveList } from "../../features/observe/hooks/useObserveList.js";
import { UserResultRow } from "../../components/observe/UserResultRow.jsx";
import { LockIcon, UserIcon, UsersIcon } from "../../components/icons/index.jsx";

// A profile's observers or observing list. kind: 'observers' | 'observing'.
function ObserveListPage({ session, kind }) {
  const { username } = useParams();
  const { profile, canViewRatings, loading, notFound } = useProfileData(username, session);
  const { list, loading: listLoading } = useObserveList(canViewRatings ? profile?.id : null, kind);
  const heading = kind === "observers" ? "Observers" : "Observing";
  const breadcrumbs = [{ label: username, to: `/u/${username}` }, { label: heading }];

  if (loading) {
    return <AppLayout session={session} breadcrumbs={breadcrumbs}><PageContainer width="narrow" className="space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-14 rounded-xl" /></PageContainer></AppLayout>;
  }
  if (notFound || !profile) {
    return <AppLayout session={session}><EmptyState icon={UserIcon} title="Profile not found" description={`@${username} doesn't exist.`} /></AppLayout>;
  }

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead title={`${heading} — ${profile.username}`} path={`/u/${profile.username}/${kind}`} noindex />
      <PageContainer width="narrow" className="space-y-4">
        <PageHeader size="sm" title={heading} subtitle={`@${profile.username}`} />
        {!canViewRatings ? (
          <EmptyState icon={LockIcon} title="This account is private" className="rounded-2xl border border-border/50 bg-surface" />
        ) : listLoading ? (
          <div className="space-y-2"><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-14 rounded-xl" /></div>
        ) : list.length === 0 ? (
          <EmptyState compact icon={UsersIcon} title={kind === "observers" ? "No observers yet." : "Not observing anyone yet."} />
        ) : (
          <div className="space-y-2">{list.map((u) => <UserResultRow key={u.id} user={u} session={session} />)}</div>
        )}
      </PageContainer>
    </AppLayout>
  );
}

export default ObserveListPage;
