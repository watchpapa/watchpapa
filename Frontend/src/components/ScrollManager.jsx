import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Per-history-entry scroll positions, keyed by location.key — the same approach
// react-router's own <ScrollRestoration> uses. Module scope so they outlive
// re-renders (this component never unmounts). Keys regenerate on a hard reload,
// so saved positions are naturally dropped then.
const positions = new Map();

// Latest window scrollY, tracked continuously. Read synchronously in the layout
// effect to save the *outgoing* entry's position before this commit's DOM swap
// can clamp window.scrollY (navigating to a shorter page).
let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;

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
  if (targetY <= 0) {
    window.scrollTo(0, 0);
    return () => {};
  }
  restoringRef.current = true;
  let done = false;
  let raf = 0;
  const start = performance.now();

  const maxY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const apply = () => window.scrollTo(0, Math.min(targetY, maxY()));
  const atTarget = () => Math.abs(window.scrollY - targetY) <= 2;

  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    ABORT_EVENTS.forEach((e) => window.removeEventListener(e, onAbort));
    restoringRef.current = false;
  };

  const onAbort = () => finish(); // user took over — never fight them
  // <body> grows as content streams in; <html>'s own box stays viewport-sized,
  // so observe the body.
  const ro = new ResizeObserver(() => {
    if (done) return;
    apply();
    if (atTarget()) finish();
  });

  const tick = () => {
    if (done) return;
    apply();
    // Stop once we've reached the saved offset, or the page genuinely can't
    // scroll that far yet and we've been retrying for a while.
    if (atTarget() || performance.now() - start > 1500) return finish();
    raf = requestAnimationFrame(tick);
  };

  ABORT_EVENTS.forEach((e) => window.addEventListener(e, onAbort, { passive: true, once: true }));
  ro.observe(document.body);
  tick();

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

  const prevKeyRef = useRef(location.key);
  const prevPathRef = useRef(location.pathname);
  const restoringRef = useRef(false);
  const cancelRef = useRef(null);

  useEffect(() => {
    setManualRestoration(); // re-assert after HMR / bfcache restore
    const onScroll = () => {
      if (!restoringRef.current) lastScrollY = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const prevKey = prevKeyRef.current;
    const prevPath = prevPathRef.current;

    // Save the position of the entry we're leaving — `lastScrollY` still holds
    // the pre-navigation value here (the browser's scroll-clamp on a shorter
    // new page fires its event asynchronously, after this effect).
    if (prevKey !== location.key) positions.set(prevKey, lastScrollY);
    prevKeyRef.current = location.key;
    prevPathRef.current = location.pathname;

    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }

    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) el.scrollIntoView();
      lastScrollY = window.scrollY;
      return undefined;
    }

    if (navType === "POP") {
      const target = positions.get(location.key) ?? 0;
      lastScrollY = target;
      cancelRef.current = restoreScroll(target, restoringRef);
    } else if (navType === "REPLACE") {
      // Same page, new key (a tab/filter/query edit) — carry the position over.
      positions.set(location.key, lastScrollY);
    } else if (location.pathname !== prevPath) {
      window.scrollTo(0, 0);
      lastScrollY = 0;
    } else {
      lastScrollY = window.scrollY;
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
