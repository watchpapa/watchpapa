import { useEffect, useState } from "react";

// Reactive `matchMedia`. Returns the current match and re-renders on change.
export function useMediaQuery(query) {
  const get = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// Shared breakpoint helpers — keep these in sync with the @theme breakpoints
// in styles/globals.css.
export const useIsPhone = () => !useMediaQuery("(min-width: 768px)");
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
export const useIsLandscapeShort = () => useMediaQuery("(orientation: landscape) and (max-height: 500px)");
export const useIsTouch = () => useMediaQuery("(hover: none)");
