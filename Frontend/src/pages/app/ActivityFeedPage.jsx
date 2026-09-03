import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useActivityFeed } from "../../features/observe/hooks/useActivityFeed.js";
import { HeartDisplay } from "../../components/rating/HeartDisplay.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";


function entityLink(item) {
  switch (item.media_type) {
    case "movie":
      return `/movies/${item.tmdbId}`;
    case "show":
      return `/shows/${item.showId}`;
    case "season":
      return `/shows/${item.showId}/seasons/${item.seasonNumber}`;
    case "episode":
      return `/shows/${item.showId}/seasons/${item.seasonNumber}/episodes/${item.episodeNumber}`;
    default:
      return "/";
  }
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TYPE_LABEL = { movie: "Movie", show: "Show", season: "Season", episode: "Episode" };

function FeedRow({ item }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#2a3570]/50 bg-[#0d0f1e] p-3">
      <Link to={entityLink(item)} className="shrink-0">
        <div className="h-[84px] w-14 overflow-hidden rounded-lg border border-[#2a3570] bg-[#12163a]">
          {item.poster_path ? (
            <img src={tmdbImg(item.poster_path, "w154")} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-full w-full" />
          )}
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#8888c8]">
          <Link to={`/u/${item.username}`} className="font-semibold text-[#a0a0e8] hover:text-white">{item.username}</Link>
          {" rated "}
          <span className="text-[#5050a0]">· {TYPE_LABEL[item.media_type] ?? ""} · {timeAgo(item.rated_at)}</span>
        </p>
        <Link to={entityLink(item)} className="mt-0.5 block truncate text-sm font-bold text-white hover:text-[#a0a0e8]">
          {item.title ?? "Untitled"}
        </Link>
        <div className="mt-1 flex items-center gap-1.5">
          <HeartDisplay value={item.value} size="sm" />
          <span className="text-xs font-semibold text-[#a090ff]">{item.value}/10</span>
        </div>
      </div>
    </div>
  );
}

function ActivityFeedPage({ session, showAdult }) {
  const { items, loading, hasMore, loadMore } = useActivityFeed(session, showAdult);

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Activity" }]}>
      <PageHead title="Activity" description="Recent ratings from people you observe." path="/feed" noindex />
      <div className="mx-auto max-w-2xl space-y-4 py-6 px-4 sm:px-0">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Activity</h1>
          <p className="mt-1 text-sm text-[#8888c8]">Recent ratings from people you observe.</p>
        </div>

        {loading && items.length === 0 && (
          <div className="animate-pulse space-y-3">
            <div className="h-[108px] rounded-xl bg-[#1a1f3a]" />
            <div className="h-[108px] rounded-xl bg-[#1a1f3a]" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18] py-16 text-center">
            <p className="text-sm font-semibold text-white">Nothing here yet</p>
            <p className="mt-1 text-xs text-[#5050a0]">
              Observe people from <Link to="/users" className="text-[#8383e7] hover:text-white">Find People</Link> to see their ratings here.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => <FeedRow key={item.rating_id} item={item} />)}
          </div>
        )}

        {hasMore && items.length > 0 && (
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full rounded-xl border border-[#2a2f5a] py-2.5 text-sm font-semibold text-[#8383e7] transition hover:border-[#5a5aaa] hover:text-white disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </AppLayout>
  );
}

export default ActivityFeedPage;
