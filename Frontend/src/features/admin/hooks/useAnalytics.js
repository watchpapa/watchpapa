// Used by:
// - Frontend/src/pages/admin/AnalyticsPage.jsx
import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../adminFetch.js";

const EMPTY = {
  dauWauMau: null,
  heatmapDow: null,
  heatmapHour: null,
  pagesPerSession: null,
  topContent: null,
  clickByType: null,
  clickBySource: null,
  genreClicks: null,
  followByGenre: null,
  followByType: null,
  newUserActivation: null,
  unfollowRate: null,
  exclusions: null,
};

export function useAnalytics() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        dauWauMau,
        heatmapDow,
        heatmapHour,
        pagesPerSession,
        topContent,
        clickByType,
        clickBySource,
        genreClicks,
        followByGenre,
        followByType,
        newUserActivation,
        unfollowRate,
        exclusions,
      ] = await Promise.all([
        adminFetch("/api/admin/analytics/dau-wau-mau"),
        adminFetch("/api/admin/analytics/heatmap-dow"),
        adminFetch("/api/admin/analytics/heatmap-hour"),
        adminFetch("/api/admin/analytics/pages-per-session"),
        adminFetch("/api/admin/analytics/top-content?limit=100"),
        adminFetch("/api/admin/analytics/click-by-type"),
        adminFetch("/api/admin/analytics/click-by-source"),
        adminFetch("/api/admin/analytics/genre-clicks?limit=15"),
        adminFetch("/api/admin/analytics/follow-by-genre?limit=15"),
        adminFetch("/api/admin/analytics/follow-by-type"),
        adminFetch("/api/admin/analytics/new-user-activation"),
        adminFetch("/api/admin/analytics/unfollow-rate"),
        adminFetch("/api/admin/analytics/exclusions"),
      ]);
      setData({
        dauWauMau,
        heatmapDow,
        heatmapHour,
        pagesPerSession,
        topContent,
        clickByType,
        clickBySource,
        genreClicks,
        followByGenre,
        followByType,
        newUserActivation,
        unfollowRate,
        exclusions,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addExclusion = useCallback(async (profileId, note = "") => {
    await adminFetch("/api/admin/analytics/exclusions", {
      method: "POST",
      body: JSON.stringify({ profile_id: profileId, note }),
    });
    await load();
  }, [load]);

  const removeExclusion = useCallback(async (profileId) => {
    await adminFetch(`/api/admin/analytics/exclusions/${profileId}`, { method: "DELETE" });
    await load();
  }, [load]);

  return { data, loading, error, refresh: load, addExclusion, removeExclusion };
}
