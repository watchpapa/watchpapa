import { useCallback } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn.js";

// Keyboard-navigable menu (WAI-ARIA `menu`): ArrowUp/Down/Home/End move focus
// between `MenuItem`s, typed inside a Popover or Sheet.
export function Menu({ children, className, label, ...props }) {
  const onKeyDown = useCallback((e) => {
    const items = Array.from(e.currentTarget.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])'));
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement);
    let next = null;
    if (e.key === "ArrowDown") next = items[(idx + 1) % items.length];
    else if (e.key === "ArrowUp") next = items[(idx - 1 + items.length) % items.length];
    else if (e.key === "Home") next = items[0];
    else if (e.key === "End") next = items[items.length - 1];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }, []);

  return (
    <div role="menu" aria-label={label} onKeyDown={onKeyDown} className={cn("py-1", className)} {...props}>
      {children}
    </div>
  );
}

export function MenuGroup({ label, children, className }) {
  return (
    <div role="group" aria-label={label} className={cn("px-2 py-1", className)}>
      {label && <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-faint">{label}</p>}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function MenuDivider() {
  return <div role="separator" className="my-1 h-px bg-border/50" />;
}

// `to` → Link, `href` → anchor, else button. `badge` shows a count on the right.
export function MenuItem({ to, href, onClick, icon: Icon, children, badge, danger = false, disabled = false, className, trailing, ...props }) {
  const classes = cn(
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:bg-surface-2",
    danger ? "text-red-300 hover:bg-red-950/40 hover:text-white" : "text-text hover:bg-surface-2 hover:text-white",
    disabled && "pointer-events-none opacity-50",
    className,
  );
  const inner = (
    <>
      {Icon && <Icon size={17} className="shrink-0 opacity-80" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge != null && badge !== 0 && badge !== false && (
        <span className="ml-auto shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#1a0b2e]">
          {typeof badge === "number" && badge > 99 ? "99+" : badge}
        </span>
      )}
      {trailing}
    </>
  );
  if (to) {
    return (
      <Link role="menuitem" to={to} onClick={onClick} className={classes} aria-disabled={disabled || undefined} tabIndex={-1} {...props}>
        {inner}
      </Link>
    );
  }
  if (href) {
    return (
      <a role="menuitem" href={href} onClick={onClick} className={classes} tabIndex={-1} {...props}>
        {inner}
      </a>
    );
  }
  return (
    <button role="menuitem" type="button" onClick={onClick} disabled={disabled} className={classes} tabIndex={-1} {...props}>
      {inner}
    </button>
  );
}
