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

export function useStaff() {
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/users/staff");
      const data = await res.json();
      setStaff(data.staff ?? []);
    } catch (e) {
      setError(e.message);
    }
    setIsLoading(false);
  }, []);

  const setRole = useCallback(async (id, role) => {
    await adminFetch(`/api/admin/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  }, []);

  return { staff, isLoading, error, fetchStaff, setRole };
}
