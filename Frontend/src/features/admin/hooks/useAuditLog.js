import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../adminFetch.js";

const FILTER_KEYS = ["action", "email", "user_id", "target_user_id", "path", "source", "from", "to"];

// App events (public.audit_events) or, with kind: "auth", Supabase Auth's own
// log. The action registry (groups, labels, colours) comes from the Worker so
// the UI never hard-codes action names.
export function useAuditLog() {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registry, setRegistry] = useState(null);

  useEffect(() => {
    let alive = true;
    adminFetch("/api/admin/audit-log/actions").then((r) => { if (alive) setRegistry(r); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const fetch = useCallback(async ({ kind = "app", page = 1, limit = 50, ...filters } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, limit });
      for (const k of FILTER_KEYS) if (filters[k]) params.set(k, filters[k]);
      const data = await adminFetch(`/api/admin/audit-log${kind === "auth" ? "/auth" : ""}?${params}`);
      setEvents(data.events);
      setTotal(data.total);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { events, total, loading, error, fetch, registry };
}
