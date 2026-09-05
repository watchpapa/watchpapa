import { useEffect } from "react";

let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

// Locks page scroll while `active` (drawers, sheets, modals). Reference-counted
// so nested overlays don't unlock each other; compensates for the scrollbar
// width on desktop so the layout doesn't shift.
export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const body = document.body;
    if (lockCount === 0) {
      savedOverflow = body.style.overflow;
      savedPaddingRight = body.style.paddingRight;
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        body.style.overflow = savedOverflow;
        body.style.paddingRight = savedPaddingRight;
      }
    };
  }, [active]);
}
