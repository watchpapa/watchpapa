import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useEffect, useState } from "react";

function AdminRoute({ session, children }) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    supabase
      .from("profile")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRole(data?.role ?? null);
        setLoading(false);
      });
  }, [session?.user?.id]);

  if (!session) return <Navigate to="/" replace />;
  if (loading) return null;
  if (role !== 4) return <Navigate to="/" replace />;
  return children;
}

export default AdminRoute;
