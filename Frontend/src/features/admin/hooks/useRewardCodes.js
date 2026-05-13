import { useCallback, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function adminFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res;
}

export function useRewardCodes() {
  const [codes, setCodes] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCodes = useCallback(async ({ page = 1, limit = 50, status = "all" } = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/reward-codes?page=${page}&limit=${limit}&status=${status}`);
      const data = await res.json();
      setCodes(data.codes ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e.message);
    }
    setIsLoading(false);
  }, []);

  const generateCodes = useCallback(async (params) => {
    const res = await adminFetch("/api/admin/reward-codes/generate", {
      method: "POST",
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data.codes ?? [];
  }, []);

  const createCustomCode = useCallback(async (params) => {
    const res = await adminFetch("/api/admin/reward-codes", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return (await res.json()).code;
  }, []);

  const toggleActive = useCallback(async (id, isActive) => {
    await adminFetch(`/api/admin/reward-codes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
  }, []);

  const editCode = useCallback(async (id, params) => {
    await adminFetch(`/api/admin/reward-codes/${id}`, {
      method: "PUT",
      body: JSON.stringify(params),
    });
  }, []);

  const deleteCode = useCallback(async (id) => {
    await adminFetch(`/api/admin/reward-codes/${id}`, { method: "DELETE" });
  }, []);

  const fetchClaims = useCallback(async (id) => {
    const res = await adminFetch(`/api/admin/reward-codes/${id}/claims`);
    const data = await res.json();
    return data.claims ?? [];
  }, []);

  const exportCsv = useCallback(async (status = "all") => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api/admin/reward-codes/export?status=${status}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "reward-codes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return { codes, total, isLoading, error, fetchCodes, generateCodes, createCustomCode, toggleActive, editCode, deleteCode, fetchClaims, exportCsv };
}
