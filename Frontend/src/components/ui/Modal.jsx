import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn.js";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";
import { useEscapeKey } from "../../hooks/useEscapeKey.js";
import { XIcon } from "../icons/index.jsx";
import IconButton from "./IconButton.jsx";

const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

// Centered dialog on sm+; full-screen on phones. Portaled, scroll-locked,
// Escape/backdrop close, focus moved in and restored.
function Modal({ open, onClose, title, size = "md", children, footer, className, panelClassName, hideClose = false }) {
  const panelRef = useRef(null);
  useBodyScrollLock(open);
  useEscapeKey(onClose, open);

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

  return createPortal(
    <div className={cn("fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4", className)} role="presentation">
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "relative flex max-h-[100svh] w-full flex-col overflow-hidden border-border bg-surface shadow-2xl shadow-black/60",
          "h-[100svh] animate-slide-up sm:h-auto sm:max-h-[90svh] sm:animate-fade-slide-down sm:rounded-2xl sm:border",
          "pt-safe pb-safe sm:pt-0 sm:pb-0",
          SIZES[size] ?? SIZES.md,
          panelClassName,
        )}
      >
        {(title || !hideClose) && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 py-3 sm:px-5">
            {typeof title === "string" ? <h2 className="min-w-0 truncate text-base font-bold text-white">{title}</h2> : title ?? <span />}
            {!hideClose && (
              <IconButton label="Close" size="sm" onClick={onClose}>
                <XIcon size={18} />
              </IconButton>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-border/50 px-4 py-3 sm:px-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
