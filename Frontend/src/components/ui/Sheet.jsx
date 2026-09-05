import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn.js";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";
import { useEscapeKey } from "../../hooks/useEscapeKey.js";
import { XIcon } from "../icons/index.jsx";
import IconButton from "./IconButton.jsx";

// Slide-in panel: bottom sheet by default (phones), or a side drawer.
//   side  — "bottom" | "left" | "right"
//   title — optional header with a close button
// Portaled, scroll-locked, closes on backdrop click / Escape. On rotated phones
// (`landscape-short`) a bottom sheet automatically becomes a right-side panel
// so it doesn't eat the whole 390px-tall viewport.
function Sheet({ open, onClose, side = "bottom", title, children, className, panelClassName, maxHeight = "85svh", width = 360, footer, labelledBy }) {
  const panelRef = useRef(null);
  useBodyScrollLock(open);
  useEscapeKey(onClose, open);

  // Move focus inside when opened; restore when closed.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector("[data-autofocus], button, a, input, select, textarea");
      first?.focus?.({ preventScroll: true });
    }, 30);
    return () => {
      clearTimeout(t);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  const isBottom = side === "bottom";
  const isLeft = side === "left";

  return createPortal(
    <div className={cn("fixed inset-0 z-[90]", className)} role="presentation">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={!labelledBy && typeof title === "string" ? title : undefined}
        style={{
          "--sheet-w": `${width}px`,
          "--sheet-max-h": maxHeight,
        }}
        className={cn(
          "absolute flex flex-col overflow-hidden border-border bg-surface shadow-2xl shadow-black/60",
          isBottom &&
            "inset-x-0 bottom-0 max-h-[var(--sheet-max-h)] animate-slide-up rounded-t-3xl border-t pb-safe landscape-short:inset-y-0 landscape-short:left-auto landscape-short:right-0 landscape-short:max-h-none landscape-short:w-[min(var(--sheet-w),90vw)] landscape-short:animate-slide-in-right landscape-short:rounded-none landscape-short:border-l landscape-short:border-t-0",
          isLeft && "inset-y-0 left-0 w-[min(var(--sheet-w),88vw)] animate-slide-in-left border-r pt-safe pb-safe",
          side === "right" && "inset-y-0 right-0 w-[min(var(--sheet-w),88vw)] animate-slide-in-right border-l pt-safe pb-safe",
          panelClassName,
        )}
      >
        {isBottom && (
          <div className="flex shrink-0 justify-center pt-2.5 landscape-short:hidden" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-border-strong" />
          </div>
        )}
        {(title || onClose) && (
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3">
            {typeof title === "string" ? <h2 className="min-w-0 truncate text-base font-bold text-white">{title}</h2> : title ?? <span />}
            <IconButton label="Close" size="sm" onClick={onClose}>
              <XIcon size={18} />
            </IconButton>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-border/50 px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Sheet;
