import { Navigate } from "react-router-dom";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";

// Role comes from CurrentUserContext (fetched once at boot) — no extra query.
function AdminRoute({ session, children }) {
  const { isAdmin, loading } = useCurrentUser();
  if (!session) return <Navigate to="/" replace />;
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default AdminRoute;
