import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { useObserveRequests } from "../../features/observe/hooks/useObserveRequests.js";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import { UserPlusIcon } from "../../components/icons/index.jsx";

function RequestRow({ request, onRespond }) {
  const username = request.observer?.username ?? "Someone";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-surface p-3 sm:flex-row sm:items-center">
      <Link to={`/u/${username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-sm font-bold text-text-link">{(username[0] ?? "?").toUpperCase()}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{username}</p>
          <p className="text-xs text-text-faint">wants to observe you</p>
        </div>
      </Link>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
        <Button size="sm" onClick={() => onRespond(request.observer_id, true)}>Accept</Button>
        <Button size="sm" variant="outline" onClick={() => onRespond(request.observer_id, false)}>Deny</Button>
      </div>
    </div>
  );
}

function ObserveRequestsPage({ session }) {
  const { requests, loading, respond } = useObserveRequests(session);
  const { refreshCounts } = useCurrentUser();
  const handleRespond = async (id, accept) => { await respond(id, accept); refreshCounts(); };

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Observe Requests" }]}>
      <PageHead title="Observe Requests" path="/observe-requests" noindex />
      <PageContainer width="narrow" className="space-y-4">
        <PageHeader title="Observe Requests" subtitle="People asking to observe your private account." />
        {loading ? (
          <div className="space-y-2"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>
        ) : requests.length === 0 ? (
          <EmptyState icon={UserPlusIcon} title="No pending requests" className="rounded-2xl border border-border/50 bg-surface" />
        ) : (
          <div className="space-y-2">{requests.map((r) => <RequestRow key={r.observer_id} request={r} onRespond={handleRespond} />)}</div>
        )}
      </PageContainer>
    </AppLayout>
  );
}

export default ObserveRequestsPage;
