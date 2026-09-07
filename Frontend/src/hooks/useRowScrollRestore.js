import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Remember each horizontal poster row's scrollLeft per history entry, so
// pressing Back restores "…and a bit to the side" too. Keyed by
// `${location.key}::${rowKey}`; in-memory, bounded.
const rowPositions = new Map();
const MAX_ENTRIES = 300;

function remember(id, value) {
  rowPositions.set(id, value);
  if (rowPositions.size > MAX_ENTRIES) {
    rowPositions.delete(rowPositions.keys().next().value);
  }
}

// scrollRef: ref to the overflow-x container. rowKey: stable id for this row on
// this page. ready: true once the row has content (so restore has somewhere to
// scroll to).
export function useRowScrollRestore(scrollRef, rowKey, ready) {
  const { key: locKey } = useLocation();
  const navType = useNavigationType();
  const id = `${locKey}::${rowKey}`;
  const rafRef = useRef(0);

  // Restore — only on Back/Forward, and only if we saved a non-zero offset.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !ready || navType !== "POP") return undefined;
    const want = rowPositions.get(id) ?? 0;
    if (!want) return undefined;

    let tries = 0;
    const tick = () => {
      el.scrollLeft = want;
      if (Math.abs(el.scrollLeft - want) <= 2 || ++tries > 20) return;
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready, navType]);

  // Save, rAF-throttled.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => remember(id, el.scrollLeft));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}
