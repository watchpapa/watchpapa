import { useCallback, useState } from "react";
import { adminFetch } from "../adminFetch.js";

export function useAuditLog() {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async ({ page = 1, limit = 50, action = "", email = "", from = "", to = "" } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, limit });
      if (action) params.set("action", action);
      if (email)  params.set("email", email);
      if (from)   params.set("from", from);
      if (to)     params.set("to", to);
      const data = await adminFetch(`/api/admin/audit-log?${params}`);
      setEvents(data.events);
      setTotal(data.total);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { events, total, loading, error, fetch };
}
