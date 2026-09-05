import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn.js";
import { SpinnerIcon } from "../icons/index.jsx";

const VARIANTS = {
  primary:
    "border border-brand bg-gradient-to-b from-brand to-brand-deep text-white shadow-glow-sm hover:from-[#8585ef] hover:to-brand",
  secondary:
    "border border-border-strong bg-surface-3 text-text-link hover:border-border-hover hover:text-white",
  outline:
    "border border-border bg-transparent text-text-dim hover:border-border-strong hover:text-white",
  ghost:
    "border border-transparent bg-transparent text-text-muted hover:bg-surface-2 hover:text-white",
  danger:
    "border border-red-900/60 bg-red-950/40 text-red-300 hover:border-red-700 hover:bg-red-900/50 hover:text-white",
  success:
    "border border-emerald-800/60 bg-emerald-950/40 text-emerald-300 hover:border-emerald-600 hover:text-white",
};

const SIZES = {
  xs: "h-8 px-2.5 text-xs gap-1.5 rounded-lg",
  sm: "h-9 px-3 text-xs gap-1.5 rounded-xl",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-base gap-2 rounded-2xl",
};

// The one button. `variant`/`size` cover every hand-rolled button style in the
// app; `to`/`href` render a Link/anchor with the same look; `loading` swaps in
// a spinner and disables. Tap targets stay ≥36px (sm) / 40px (md).
const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    type = "button",
    className,
    children,
    disabled = false,
    loading = false,
    full = false,
    icon: Icon,
    iconRight: IconRight,
    to,
    href,
    ...props
  },
  ref,
) {
  const classes = cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    full && "w-full",
    className,
  );
  const content = (
    <>
      {loading ? <SpinnerIcon size={size === "lg" ? 18 : 16} /> : Icon ? <Icon size={size === "lg" ? 18 : 16} /> : null}
      {children}
      {IconRight ? <IconRight size={size === "lg" ? 18 : 16} /> : null}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} aria-disabled={disabled || undefined} {...props}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
});

export default Button;
