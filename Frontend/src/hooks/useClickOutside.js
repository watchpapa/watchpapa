import { useEffect } from "react";

// Calls `onOutside` on a pointerdown that lands outside every ref in `refs`.
// Only bound while `active` so idle menus cost nothing.
export function useClickOutside(refs, onOutside, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const list = Array.isArray(refs) ? refs : [refs];
    function onPointerDown(e) {
      const inside = list.some((r) => r?.current && r.current.contains(e.target));
      if (!inside) onOutside(e);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [refs, onOutside, active]);
}
