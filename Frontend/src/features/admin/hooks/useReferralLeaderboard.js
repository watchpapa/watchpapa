import { useEffect, useState } from "react";
import { adminFetch } from "../adminFetch.js";

export function useReferralLeaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    adminFetch("/api/admin/referrals/leaderboard")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return { data, loading, error, refresh: load };
}
