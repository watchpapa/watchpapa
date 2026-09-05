import { useCurrentUser } from "../../profile/CurrentUserContext.jsx";

// Kept for existing call sites; now reads the role CurrentUserContext already
// fetched instead of running its own `profile.role` query.
export function useIsAdmin() {
  const { isAdmin, loading } = useCurrentUser();
  return { isAdmin, loading };
}
