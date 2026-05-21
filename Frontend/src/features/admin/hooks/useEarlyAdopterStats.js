import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function adminGet(path) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function useEarlyAdopterStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [list, setList] = useState([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const LIST_LIMIT = 50;

  useEffect(() => {
    setLoading(true);
    adminGet("/api/admin/stats/early-adopters")
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function refresh() {
    setLoading(true);
    setError(null);
    adminGet("/api/admin/stats/early-adopters")
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  const fetchList = useCallback(async (page = 1) => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await adminGet(
        `/api/admin/stats/early-adopters/list?page=${page}&limit=${LIST_LIMIT}`
      );
      setList(data.list ?? []);
      setListTotal(data.total ?? 0);
      setListPage(page);
    } catch (err) {
      setListError(err.message);
    }
    setListLoading(false);
  }, []);

  return {
    stats, loading, error, refresh,
    list, listTotal, listPage, listLoading, listError, fetchList, LIST_LIMIT,
  };
}
