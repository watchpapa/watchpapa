import { useCallback, useState } from "react";
import { adminFetch } from "../adminFetch.js";

// Backs /admin/tier-rewards — issue a bulk tier reward, list recent batches,
// estimate the "All users" blast radius, and search users for the picker.
export function useTierRewards() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch("/api/admin/tier-rewards");
      setBatches(data.batches ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEligibleCount = useCallback(async (tier) => {
    return adminFetch(`/api/admin/tier-rewards/eligible-count?tier=${encodeURIComponent(tier)}`);
  }, []);

  const issueReward = useCallback(async (params) => {
    return adminFetch("/api/admin/tier-rewards", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }, []);

  const searchUsers = useCallback(async (query) => {
    const data = await adminFetch(`/api/admin/users/search?email=${encodeURIComponent(query)}`);
    return data.users ?? [];
  }, []);

  return { batches, loading, error, fetchBatches, fetchEligibleCount, issueReward, searchUsers };
}
