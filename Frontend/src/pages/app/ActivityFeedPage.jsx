import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import LoadMoreButton from "../../components/ui/LoadMoreButton.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { useActivityFeed } from "../../features/observe/hooks/useActivityFeed.js";
import { HeartDisplay } from "../../components/rating/HeartDisplay.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { ActivityIcon } from "../../components/icons/index.jsx";

function entityLink(item) {
  switch (item.media_type) {
    case "movie": return `/movies/${item.tmdbId}`;
    case "show": return `/shows/${item.showId}`;
    case "season": return `/shows/${item.showId}/seasons/${item.seasonNumber}`;
    case "episode": return `/shows/${item.showId}/seasons/${item.seasonNumber}/episodes/${item.episodeNumber}`;
    default: return "/";
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
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface p-3">
      <Link to={entityLink(item)} className="shrink-0">
        <div className="h-[84px] w-14 overflow-hidden rounded-lg border border-border bg-surface-4">
          {item.poster_path && <img src={tmdbImg(item.poster_path, "w154")} alt={item.title} className="h-full w-full object-cover" loading="lazy" />}
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-muted">
          <Link to={`/u/${item.username}`} className="font-semibold text-text-link hover:text-white">{item.username}</Link>
          {" rated "}
          <span className="text-text-faint">· {TYPE_LABEL[item.media_type] ?? ""} · {timeAgo(item.rated_at)}</span>
        </p>
        <Link to={entityLink(item)} className="mt-0.5 block truncate text-sm font-bold text-white hover:text-text-link">{item.title ?? "Untitled"}</Link>
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
      <PageContainer width="reading" className="space-y-4">
        <PageHeader title="Activity" subtitle="Recent ratings from people you observe." />
        {loading && items.length === 0 && <div className="space-y-3"><Skeleton className="h-[108px] rounded-xl" /><Skeleton className="h-[108px] rounded-xl" /></div>}
        {!loading && items.length === 0 && (
          <EmptyState icon={ActivityIcon} title="Nothing here yet" description="Observe people to see their ratings here." action={<Button to="/users" variant="secondary" size="sm">Find people</Button>} className="rounded-2xl border border-border/50 bg-surface" />
        )}
        {items.length > 0 && <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">{items.map((item) => <FeedRow key={item.rating_id} item={item} />)}</div>}
        {items.length > 0 && <LoadMoreButton onClick={loadMore} loading={loading} hasMore={hasMore} />}
      </PageContainer>
    </AppLayout>
  );
}

export default ActivityFeedPage;
