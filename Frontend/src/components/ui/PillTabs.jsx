import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn.js";

// Segmented pill tabs — the pattern hand-copied in 8 places. Horizontal
// scroll with snap on narrow screens (never wraps/overflows), the active tab
// is scrolled into view, and the whole thing is a real tablist.
//
// tabs: [{ value, label, count?, badge?, icon?: Component, disabled?, className? }]
function PillTabs({ tabs, value, onChange, size = "md", className, fill = false, "aria-label": ariaLabel }) {
  const listRef = useRef(null);
  const activeRef = useRef(null);

  // Keep the active pill visible by scrolling ONLY this tablist's own
  // horizontal overflow — never scrollIntoView(), which also walks the window
  // and yanks the whole page vertically when the strip is below the fold.
  useEffect(() => {
    const c = listRef.current;
    const a = activeRef.current;
    if (!c || !a) return;
    const cr = c.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    const pad = 8;
    if (ar.left < cr.left + pad) c.scrollLeft -= cr.left + pad - ar.left;
    else if (ar.right > cr.right - pad) c.scrollLeft += ar.right - (cr.right - pad);
  }, [value]);

  const sizeClass = size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-11 px-5 text-sm" : "h-10 px-4 text-sm";

  function onKeyDown(e) {
    const idx = tabs.findIndex((t) => t.value === value);
    if (idx < 0) return;
    let next = null;
    if (e.key === "ArrowRight") next = tabs[(idx + 1) % tabs.length];
    if (e.key === "ArrowLeft") next = tabs[(idx - 1 + tabs.length) % tabs.length];
    if (e.key === "Home") next = tabs[0];
    if (e.key === "End") next = tabs[tabs.length - 1];
    if (next && !next.disabled) {
      e.preventDefault();
      onChange(next.value);
    }
  }

  return (
    <div
      role="tablist"
      ref={listRef}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "scrollbar-none flex max-w-full snap-x gap-1 overflow-x-auto rounded-xl border border-border/50 bg-surface p-1",
        fill && "w-full",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            ref={active ? activeRef : null}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={t.disabled}
            onClick={() => onChange(t.value)}
            className={cn(
              "inline-flex shrink-0 snap-start items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light disabled:opacity-40",
              sizeClass,
              fill && "flex-1",
              active
                ? "bg-gradient-to-b from-brand to-brand-deep text-white shadow-glow-sm"
                : "text-text-muted hover:bg-surface-2 hover:text-white",
              t.className,
            )}
          >
            {Icon && <Icon size={15} />}
            {t.label}
            {t.count != null && (
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none", active ? "bg-white/20 text-white" : "bg-surface-3 text-text-dim")}>
                {t.count}
              </span>
            )}
            {t.badge != null && t.badge !== 0 && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#1a0b2e]">{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default PillTabs;
