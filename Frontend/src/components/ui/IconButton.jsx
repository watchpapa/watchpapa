import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn.js";

const SIZES = {
  sm: "h-9 w-9 rounded-lg",
  md: "h-10 w-10 rounded-xl",
  lg: "h-11 w-11 rounded-xl",
};

const VARIANTS = {
  ghost: "text-text-muted hover:bg-surface-3 hover:text-white",
  secondary: "border border-border-strong bg-surface-3 text-text-link hover:border-border-hover hover:text-white",
  outline: "border border-border text-text-dim hover:border-border-strong hover:text-white",
  danger: "text-red-300 hover:bg-red-950/50 hover:text-white",
};

// Square icon-only control with a mandatory accessible label and an optional
// numeric badge (unread counts). `to` renders a Link.
const IconButton = forwardRef(function IconButton(
  { label, size = "md", variant = "ghost", className, children, badge, active = false, to, ...props },
  ref,
) {
  const classes = cn(
    "relative inline-flex shrink-0 items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light disabled:opacity-50",
    SIZES[size] ?? SIZES.md,
    VARIANTS[variant] ?? VARIANTS.ghost,
    active && "bg-surface-3 text-white",
    className,
  );
  const inner = (
    <>
      {children}
      {badge != null && badge !== 0 && badge !== false && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-[#1a0b2e]">
          {typeof badge === "number" && badge > 99 ? "99+" : badge === true ? "" : badge}
        </span>
      )}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} aria-label={label} title={label} {...props}>
        {inner}
      </Link>
    );
  }
  return (
    <button ref={ref} type="button" className={classes} aria-label={label} title={label} {...props}>
      {inner}
    </button>
  );
});

export default IconButton;
