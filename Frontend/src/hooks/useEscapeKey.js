import { useEffect } from "react";

export function useEscapeKey(onEscape, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onEscape(e);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onEscape, active]);
}
