import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Per-history-entry scroll positions, keyed by location.key — the same approach
// react-router's own <ScrollRestoration> uses. Module scope so they outlive
// re-renders (this component never unmounts). Keys regenerate on a hard reload,
// so saved positions are naturally dropped then.
const positions = new Map();

const ABORT_EVENTS = ["wheel", "touchmove", "keydown", "pointerdown"];

function setManualRestoration() {
  if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }
}
setManualRestoration();

// Drive window.scrollTo(0, targetY) until the document is tall enough and we've
// landed (async pages grow after they fetch). Returns a canceller.
function restoreScroll(targetY, restoringRef) {
  restoringRef.current = true;
  let done = false;
  let timer = 0;

  const maxY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const apply = () => window.scrollTo(0, Math.min(targetY, maxY()));

  const finish = () => {
    if (done) return;
    done = true;
    ro.disconnect();
    clearTimeout(timer);
    ABORT_EVENTS.forEach((e) => window.removeEventListener(e, onAbort));
    restoringRef.current = false;
  };

  const onAbort = () => finish(); // user took over — never fight them
  const ro = new ResizeObserver(() => {
    apply();
    if (Math.abs(window.scrollY - targetY) <= 2) finish();
  });

  ABORT_EVENTS.forEach((e) => window.addEventListener(e, onAbort, { passive: true, once: true }));
  ro.observe(document.documentElement);
  apply();

  if (Math.abs(window.scrollY - targetY) <= 2) finish();
  else timer = setTimeout(finish, 2000);

  return finish;
}

/**
 * Client-side scroll management:
 * - PUSH to a new path  → jump to top (pre-paint, no flash)
 * - POP (back/forward)  → restore the saved position for that history entry
 * - REPLACE (tab/filter/query edits) → stay put
 * - #hash links         → let the anchor scroll happen
 */
export default function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType(); // "PUSH" | "POP" | "REPLACE"

  const keyRef = useRef(location.key);
  const prevPathRef = useRef(location.pathname);
  const restoringRef = useRef(false);
  const cancelRef = useRef(null);

  // Remember where the user is on the current history entry.
  useEffect(() => {
    setManualRestoration(); // re-assert after HMR / bfcache restore
    let raf = 0;
    const onScroll = () => {
      if (restoringRef.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => positions.set(keyRef.current, window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useLayoutEffect(() => {
    const prevPath = prevPathRef.current;
    keyRef.current = location.key;
    prevPathRef.current = location.pathname;

    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }

    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) el.scrollIntoView();
      return undefined;
    }

    if (navType === "POP") {
      cancelRef.current = restoreScroll(positions.get(location.key) ?? 0, restoringRef);
    } else if (navType === "REPLACE") {
      // Same page, new key — carry the position forward so a later POP restores it.
      positions.set(location.key, window.scrollY);
    } else if (location.pathname !== prevPath) {
      window.scrollTo(0, 0);
    }

    return () => {
      if (cancelRef.current) {
        cancelRef.current();
        cancelRef.current = null;
      }
    };
    // location.key changes on every navigation (incl. REPLACE); navType/hash/pathname
    // are all read fresh in the same render, so keying on it alone is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  return null;
}
