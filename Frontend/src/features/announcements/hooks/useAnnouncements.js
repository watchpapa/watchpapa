import { useCallback, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/announcements`);
      if (!res.ok) throw new Error("Failed to fetch announcements");
      const data = await res.json();
      setAnnouncements(data.announcements ?? []);
    } catch (e) {
      setError(e.message);
    }
    setIsLoading(false);
  }, []);

  const createAnnouncement = useCallback(async ({ title, body, image_url }) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api/announcements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body, image_url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to create announcement");
    }
    const data = await res.json();
    return data.announcement;
  }, []);

  const updateAnnouncement = useCallback(async (id, { title, body, image_url }) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api/announcements/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body, image_url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to update announcement");
    }
    return (await res.json()).announcement;
  }, []);

  const archiveAnnouncement = useCallback(async (id, archived) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api/announcements/${id}/archive`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ archived }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to update announcement");
    }
  }, []);

  return { announcements, isLoading, error, fetchAnnouncements, createAnnouncement, updateAnnouncement, archiveAnnouncement };
}
