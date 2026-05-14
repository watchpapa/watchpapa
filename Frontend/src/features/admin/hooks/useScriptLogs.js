import { useCallback, useState } from "react";
import { adminFetch } from "../adminFetch.js";

export function useScriptLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [scriptNames, setScriptNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async ({ page = 1, limit = 50, script = "", status = "" } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, limit });
      if (script) params.set("script", script);
      if (status) params.set("status", status);
      const data = await adminFetch(`/api/admin/script-logs?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
      if (data.scriptNames?.length) setScriptNames(data.scriptNames);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { logs, total, scriptNames, loading, error, fetch };
}
