import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useObserveRequests } from "../../features/observe/hooks/useObserveRequests.js";

function RequestRow({ request, onRespond }) {
  const user = request.observer;
  const username = user?.username ?? "Someone";
  const initials = (username[0] ?? "?").toUpperCase();

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#1a1f3a] bg-[#0d0f1e] px-3 py-2.5">
      <Link to={`/u/${username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#3a3a7a] bg-[#1a1d35] text-sm font-bold text-[#a0a0e8]">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{username}</p>
          <p className="text-xs text-[#5050a0]">wants to observe you</p>
        </div>
      </Link>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => onRespond(request.observer_id, true)}
          className="rounded-xl border border-[#7070d0] bg-[#3a3a8a] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#4a4aaa]"
        >
          Accept
        </button>
        <button
          onClick={() => onRespond(request.observer_id, false)}
          className="rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1.5 text-xs font-semibold text-[#8888c8] transition hover:border-[#aa5a5a] hover:text-white"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function ObserveRequestsPage({ session }) {
  const { requests, loading, respond } = useObserveRequests(session);

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Observe Requests" }]}>
      <PageHead title="Observe Requests" path="/observe-requests" noindex />
      <div className="mx-auto max-w-2xl space-y-4 py-6 px-4 sm:px-0">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Observe Requests</h1>
          <p className="mt-1 text-sm text-[#8888c8]">People asking to observe your private account.</p>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-14 rounded-xl bg-[#1a1f3a]" />
            <div className="h-14 rounded-xl bg-[#1a1f3a]" />
          </div>
        ) : requests.length === 0 ? (
          <p className="rounded-2xl border border-[#1a1f3a] bg-[#0a0c18] py-16 text-center text-sm text-[#5050a0]">
            No pending requests.
          </p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <RequestRow key={r.observer_id} request={r} onRespond={respond} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default ObserveRequestsPage;
