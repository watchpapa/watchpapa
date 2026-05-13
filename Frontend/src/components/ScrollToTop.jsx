import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Resets window scroll on client-side navigation so each route starts at the top. */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
