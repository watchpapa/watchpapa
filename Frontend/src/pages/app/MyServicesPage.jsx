import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import MediaRow from "../../components/home/MediaRow.jsx";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { supabase } from "../../lib/supabase.js";
import { isProTier } from "../../lib/tier.js";
import { usePreferences } from "../../features/preferences/PreferencesContext.jsx";
import { useMyServicesPageData } from "../../features/myServices/hooks/useMyServicesPageData.js";

function SkeletonRow() {
  return (
    <section className="flex flex-col items-center">
      <div className="mb-3 h-6 w-32 animate-pulse rounded bg-[#1e2240]" />
      <div className="flex w-full justify-start gap-3 overflow-x-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-[100px] flex-shrink-0 sm:w-[132px] lg:w-[150px]">
            <div className="aspect-[2/3] animate-pulse rounded-2xl bg-[#1e2240]" />
            <div className="mt-2 h-3 animate-pulse rounded bg-[#1e2240]" />
            <div className="mt-1.5 mx-auto h-5 w-16 animate-pulse rounded-full bg-[#1e2240]" />
          </div>
        ))}
      </div>
    </section>
  );
}

function GateMessage({ needsPro, needsSetup }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <h1 className="text-2xl font-extrabold text-white">My Services</h1>
      {needsPro ? (
        <p className="text-sm text-[#8888c8]">
          Picking which streaming services are yours — so this page can show what's popular, top rated, and
          suggested just for them — needs Pro.
        </p>
      ) : needsSetup ? (
        <p className="text-sm text-[#8888c8]">
          You're on Pro — head to Settings to pick your streaming services and a watch region to unlock this page.
        </p>
      ) : null}
      <Link
        to="/settings"
        className="mt-2 rounded-xl border border-[#5050a0] bg-gradient-to-b from-[#6f6fdc] to-[#4f4fb8] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(111,111,220,0.8)] transition hover:from-[#7f7fee] hover:to-[#5f5fc8]"
      >
        Go to Settings
      </Link>
    </div>
  );
}

function MyServicesPage({ session, showAdult }) {
  const { watchProviders, effectiveWatchRegions } = usePreferences();
  const [tier, setTier] = useState("free");
  const [tierLoaded, setTierLoaded] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      setTier("free");
      setTierLoaded(true);
      return;
    }
    let cancelled = false;
    supabase.rpc("get_effective_tier", { p_profile_id: session.user.id }).then(({ data }) => {
      if (!cancelled) {
        setTier(data ?? "free");
        setTierLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const {
    eligible,
    isLoading,
    popularItems,
    hasMorePopular,
    loadMorePopular,
    loadingMorePopular,
    topRatedItems,
    hasMoreTopRated,
    loadMoreTopRated,
    loadingMoreTopRated,
    suggestedItems,
    hasMoreSuggested,
    loadMoreSuggested,
    loadingMoreSuggested,
    providerRows,
    followLimitError,
    clearFollowLimitError,
  } = useMyServicesPageData(session, showAdult, tier);

  if (!tierLoaded) {
    return (
      <AppLayout session={session}>
        <SkeletonRow />
      </AppLayout>
    );
  }

  if (!isProTier(tier)) {
    return (
      <AppLayout session={session}>
        <PageHead title="My Services" description="Popular, top rated, and suggested titles on your streaming services." path="/my-services" />
        <GateMessage needsPro />
      </AppLayout>
    );
  }

  if (!watchProviders.length || effectiveWatchRegions.length === 0) {
    return (
      <AppLayout session={session}>
        <PageHead title="My Services" description="Popular, top rated, and suggested titles on your streaming services." path="/my-services" />
        <GateMessage needsSetup />
      </AppLayout>
    );
  }

  return (
    <AppLayout session={session}>
      <PageHead title="My Services" description="Popular, top rated, and suggested titles on your streaming services." path="/my-services" />
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      <div className="mx-auto max-w-[1600px] space-y-8">
        {isLoading || !eligible ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {popularItems.length > 0 && (
              <MediaRow
                title="Popular"
                items={popularItems}
                session={session}
                hasMore={hasMorePopular}
                onLoadMore={loadMorePopular}
                isLoadingMore={loadingMorePopular}
              />
            )}
            {suggestedItems.length > 0 && (
              <MediaRow
                title="Suggested For You"
                items={suggestedItems}
                session={session}
                hasMore={hasMoreSuggested}
                onLoadMore={loadMoreSuggested}
                isLoadingMore={loadingMoreSuggested}
              />
            )}
            {topRatedItems.length > 0 && (
              <MediaRow
                title="Top Rated"
                items={topRatedItems}
                session={session}
                hasMore={hasMoreTopRated}
                onLoadMore={loadMoreTopRated}
                isLoadingMore={loadingMoreTopRated}
              />
            )}
            {providerRows
              .filter((row) => row.items.length > 0)
              .map((row) => (
                <MediaRow
                  key={row.providerId}
                  title={`Popular on ${row.providerName}`}
                  items={row.items}
                  session={session}
                  hasMore={row.hasMore}
                  onLoadMore={row.onLoadMore}
                  isLoadingMore={row.isLoadingMore}
                />
              ))}
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default MyServicesPage;
