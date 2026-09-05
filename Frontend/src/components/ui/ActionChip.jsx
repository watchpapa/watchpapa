import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";
import { SpinnerIcon } from "../icons/index.jsx";

const TONES = {
  neutral: "border-border-strong bg-surface-3/70 text-text-muted hover:border-border-hover hover:text-white",
  success: "border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:border-emerald-500",
  warning: "border-amber-700/60 bg-amber-950/40 text-amber-300 hover:border-amber-500",
  brand: "border-brand/60 bg-brand/15 text-brand-light hover:border-brand",
};

// Stacked icon-over-label action (the detail page's Watched / Watchlist /
// Share row). 56px tall so it's an easy tap; `tone` colours the active state.
const ActionChip = forwardRef(function ActionChip(
  { icon: Icon, label, sublabel, tone = "neutral", loading = false, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-[11px] font-semibold leading-none transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light disabled:opacity-50",
        TONES[tone] ?? TONES.neutral,
        className,
      )}
      {...props}
    >
      {loading ? <SpinnerIcon size={18} /> : Icon ? <Icon size={18} /> : null}
      <span className="max-w-full truncate">{label}</span>
      {sublabel && <span className="text-[9px] font-medium opacity-70">{sublabel}</span>}
      {children}
    </button>
  );
});

export default ActionChip;
