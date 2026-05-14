import { useState } from "react";
import { adminFetch } from "../adminFetch.js";

export function useUserLookup() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [grantState, setGrantState] = useState({});

  async function search(email) {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch(`/api/admin/users/search?email=${encodeURIComponent(email)}`);
      setUsers(data.users);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function grantTier(userId, tier, durationDays) {
    setGrantState((s) => ({ ...s, [userId]: { loading: true, error: null, success: false } }));
    try {
      await adminFetch(`/api/admin/users/${userId}/grant-tier`, {
        method: "POST",
        body: JSON.stringify({ tier, durationDays: durationDays || null }),
      });
      setGrantState((s) => ({ ...s, [userId]: { loading: false, error: null, success: true } }));
      // Refresh the user list to show updated tier
      const existing = users.find((u) => u.id === userId);
      if (existing) search(existing.email.split("@")[0]);
    } catch (e) {
      setGrantState((s) => ({ ...s, [userId]: { loading: false, error: e.message, success: false } }));
    }
  }

  return { users, loading, error, search, grantTier, grantState };
}
