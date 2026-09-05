import { cn } from "../../lib/cn.js";

const VARIANTS = {
  neutral: "border-border-strong bg-surface-3 text-text-link",
  brand: "border-brand/60 bg-brand/20 text-brand-light",
  accent: "border-accent/50 bg-accent/15 text-accent",
  success: "border-emerald-700/50 bg-emerald-900/30 text-emerald-300",
  warning: "border-amber-700/50 bg-amber-900/30 text-amber-300",
  danger: "border-red-700/50 bg-red-900/30 text-red-300",
  info: "border-sky-700/50 bg-sky-900/30 text-sky-300",
  gold: "border-amber-500/60 bg-amber-500/20 text-amber-300",
};

const SIZES = {
  xs: "px-1.5 py-0.5 text-[10px]",
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
};

function Badge({ variant = "neutral", size = "sm", className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-semibold leading-none",
        VARIANTS[variant] ?? VARIANTS.neutral,
        SIZES[size] ?? SIZES.sm,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
