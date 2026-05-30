import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

export function useIsAdmin(session) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    supabase
      .from("profile")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(data?.role === 4);
        setLoading(false);
      });
  }, [session?.user?.id]);

  return { isAdmin, loading };
}
