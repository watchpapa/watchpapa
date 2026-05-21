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

export function useAdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/announcements");
      const data = await res.json();
      setAnnouncements(data.announcements ?? []);
    } catch (e) {
      setError(e.message);
    }
    setIsLoading(false);
  }, []);

  const restoreAnnouncement = useCallback(async (id) => {
    await adminFetch(`/api/admin/announcements/${id}/restore`, { method: "PATCH" });
  }, []);

  const deleteAnnouncement = useCallback(async (id) => {
    await adminFetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
  }, []);

  return { announcements, isLoading, error, fetchAnnouncements, restoreAnnouncement, deleteAnnouncement };
}
