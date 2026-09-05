import { useCallback, useSyncExternalStore } from "react";

// Reactive `matchMedia` via useSyncExternalStore — no setState-in-effect, and
// the first render already reflects the real viewport.
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Shared breakpoint helpers — keep these in sync with the @theme breakpoints
// in styles/globals.css.
export const useIsPhone = () => !useMediaQuery("(min-width: 768px)");
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
export const useIsLandscapeShort = () => useMediaQuery("(orientation: landscape) and (max-height: 500px)");
export const useIsTouch = () => useMediaQuery("(hover: none)");
