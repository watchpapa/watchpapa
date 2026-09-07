import AppLayout from "../../layouts/AppLayout.jsx";
import MediaRow from "../../components/home/MediaRow.jsx";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import Button from "../../components/ui/Button.jsx";
import { SkeletonPosterRow } from "../../components/ui/Skeleton.jsx";
import { isProTier } from "../../lib/tier.js";
import { usePreferences } from "../../features/preferences/PreferencesContext.jsx";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import { useMyServicesPageData } from "../../features/myServices/hooks/useMyServicesPageData.js";
import { LockIcon, PlayIcon } from "../../components/icons/index.jsx";

const HEAD = <PageHead title="My Services" description="Popular, top rated, and suggested titles on your streaming services." path="/my-services" />;

function MyServicesPage({ session, showAdult }) {
  const { watchProviders, effectiveWatchRegions } = usePreferences();
  const { tier, loading: tierLoading } = useCurrentUser();

  const {
    eligible, isLoading,
    popularItems, hasMorePopular, loadMorePopular, loadingMorePopular,
    topRatedItems, hasMoreTopRated, loadMoreTopRated, loadingMoreTopRated,
    suggestedItems, hasMoreSuggested, loadMoreSuggested, loadingMoreSuggested,
    providerRows, followLimitError, clearFollowLimitError,
  } = useMyServicesPageData(session, showAdult, tier);

  if (tierLoading) {
    return <AppLayout session={session}>{HEAD}<PageContainer width="wide"><SkeletonPosterRow /></PageContainer></AppLayout>;
  }

  if (!isProTier(tier)) {
    return (
      <AppLayout session={session}>
        {HEAD}
        <EmptyState
          icon={LockIcon}
          title="My Services is a Pro feature"
          description="Pick which streaming services are yours and this page shows what's popular, top rated and suggested on them."
          action={<div className="flex gap-2"><Button to="/subscription">See plans</Button><Button to="/settings#streaming" variant="secondary">Settings</Button></div>}
        />
      </AppLayout>
    );
  }

  if (!watchProviders.length || effectiveWatchRegions.length === 0) {
    return (
      <AppLayout session={session}>
        {HEAD}
        <EmptyState
          icon={PlayIcon}
          title="Pick your streaming services"
          description="You're on Pro — choose a watch region and your services in Settings to unlock this page."
          action={<Button to="/settings#streaming">Go to Settings</Button>}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout session={session}>
      {HEAD}
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      <PageContainer width="wide" className="space-y-8">
        <PageHeader title="My Services" subtitle="What's popular, top rated and suggested on the services you picked." actions={<Button to="/settings#streaming" variant="ghost" size="sm">Edit services</Button>} />
        {isLoading || !eligible ? (
          <><SkeletonPosterRow /><SkeletonPosterRow /><SkeletonPosterRow /></>
        ) : (
          <>
            {popularItems.length > 0 && <MediaRow rowKey="popular" title="Popular" items={popularItems} session={session} hasMore={hasMorePopular} onLoadMore={loadMorePopular} isLoadingMore={loadingMorePopular} />}
            {suggestedItems.length > 0 && <MediaRow rowKey="suggested" title="Suggested For You" items={suggestedItems} session={session} hasMore={hasMoreSuggested} onLoadMore={loadMoreSuggested} isLoadingMore={loadingMoreSuggested} />}
            {topRatedItems.length > 0 && <MediaRow rowKey="top-rated" title="Top Rated" items={topRatedItems} session={session} hasMore={hasMoreTopRated} onLoadMore={loadMoreTopRated} isLoadingMore={loadingMoreTopRated} />}
            {providerRows.filter((row) => row.items.length > 0).map((row) => (
              <MediaRow key={row.providerId} rowKey={`provider-${row.providerId}`} title={`Popular on ${row.providerName}`} items={row.items} session={session} hasMore={row.hasMore} onLoadMore={row.onLoadMore} isLoadingMore={row.isLoadingMore} />
            ))}
          </>
        )}
      </PageContainer>
    </AppLayout>
  );
}

export default MyServicesPage;
