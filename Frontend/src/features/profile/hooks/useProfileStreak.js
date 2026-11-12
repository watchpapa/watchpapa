import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api.js";

// Current and longest watch streak of a profile, from the Worker
// (GET /api/insights/streaks/:profileId -> { current, longest, lastWatchedOn, timeZone }).
// The streak is not part of the owner-tier-gated stats: whoever can view the profile sees it.
// On any error (not found, not allowed, offline) streak is null and the page shows nothing.
export function useProfileStreak(profileId, session) {
  // The result remembers which profile it belongs to, so a stale streak is never shown
  // for another profile while the new one loads.
  const [result, setResult] = useState({ forProfileId: null, data: null });

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    apiFetch(`/api/insights/streaks/${profileId}`, { session })
      .then((data) => {
        // Only accept the expected shape, so a malformed reply never renders "undefined Day streak".
        const isValid = Number.isInteger(data?.current) && Number.isInteger(data?.longest);
        if (!cancelled) setResult({ forProfileId: profileId, data: isValid ? data : null });
      })
      .catch(() => {
        if (!cancelled) setResult({ forProfileId: profileId, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  return { streak: result.forProfileId === profileId ? result.data : null };
}
