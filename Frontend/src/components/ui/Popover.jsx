import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { useEscapeKey } from "../../hooks/useEscapeKey.js";

const MARGIN = 8;

// Anchored floating panel, portaled to <body> (so backdrop-blur ancestors can't
// clip it) and clamped to the viewport so it never runs off a phone screen.
//   anchorRef — the trigger element
//   align     — "start" | "end" | "center" (horizontal edge to align with)
//   onClose   — called on outside click / Escape / resize-away
function Popover({ open, anchorRef, onClose, align = "end", width = 288, className, children, offset = 8, role = "dialog", ...props }) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const a = anchorRef?.current;
    const p = panelRef.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    const pw = p.offsetWidth || width;
    const ph = p.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = align === "start" ? r.left : align === "center" ? r.left + r.width / 2 - pw / 2 : r.right - pw;
    left = Math.max(MARGIN, Math.min(left, vw - pw - MARGIN));
    let top = r.bottom + offset;
    let flip = false;
    if (top + ph > vh - MARGIN && r.top - offset - ph > MARGIN) {
      top = r.top - offset - ph;
      flip = true;
    }
    const maxH = flip ? r.top - offset - MARGIN : vh - top - MARGIN;
    setPos({ left, top, maxH, flip });
  }, [anchorRef, align, width, offset]);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return undefined; }
    place();
    const onChange = () => place();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [open, place]);

  useClickOutside([panelRef, anchorRef], onClose, open);
  useEscapeKey(onClose, open);

  // Return focus to the anchor when closing via keyboard.
  useEffect(() => {
    if (open) return undefined;
    return () => {};
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      style={{
        position: "fixed",
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        width: `min(${width}px, calc(100vw - ${MARGIN * 2}px))`,
        maxHeight: pos?.maxH ? `${pos.maxH}px` : undefined,
        visibility: pos ? "visible" : "hidden",
      }}
      className={cn(
        "z-[80] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface shadow-xl shadow-black/50",
        pos?.flip ? "origin-bottom" : "origin-top",
        "animate-fade-slide-down",
        className,
      )}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}

export default Popover;
