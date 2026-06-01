import { useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useProfileData } from "../../features/profile/hooks/useProfileData.js";
import { useObserveList } from "../../features/observe/hooks/useObserveList.js";
import { UserResultRow } from "../../components/observe/UserResultRow.jsx";

// Shows a profile's observers or observing list. kind: 'observers' | 'observing'.
function ObserveListPage({ session, kind }) {
  const { username } = useParams();
  const { profile, canViewRatings, loading, notFound } = useProfileData(username, session);
  const { list, loading: listLoading } = useObserveList(canViewRatings ? profile?.id : null, kind);

  const heading = kind === "observers" ? "Observers" : "Observing";
  const breadcrumbs = [{ label: username, to: `/u/${username}` }, { label: heading }];

  if (loading) {
    return (
      <AppLayout session={session} breadcrumbs={breadcrumbs}>
        <div className="mx-auto max-w-2xl animate-pulse space-y-3 py-6">
          <div className="h-12 rounded-xl bg-[#1a1f3a]" />
          <div className="h-12 rounded-xl bg-[#1a1f3a]" />
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
      <PageHead title={`${heading} — ${profile.username}`} path={`/u/${profile.username}/${kind}`} noindex />
      <div className="mx-auto max-w-2xl space-y-4 py-6 px-4 sm:px-0">
        <h1 className="text-xl font-bold text-white">
          {heading} <span className="text-sm font-normal text-[#5050a0]">· @{profile.username}</span>
        </h1>

        {!canViewRatings ? (
          <p className="rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18] py-12 text-center text-sm text-[#5050a0]">
            This account is private.
          </p>
        ) : listLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-12 rounded-xl bg-[#1a1f3a]" />
            <div className="h-12 rounded-xl bg-[#1a1f3a]" />
          </div>
        ) : list.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#4a4a7a]">
            {kind === "observers" ? "No observers yet." : "Not observing anyone yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((u) => (
              <UserResultRow key={u.id} user={u} session={session} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default ObserveListPage;
