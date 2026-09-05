import { cn } from "../../lib/cn.js";

// Page title block: gradient accent bar + h1, optional eyebrow/subtitle,
// an `actions` slot that wraps under the title on phones, and `children`
// for a toolbar row (search bar, filters) beneath.
function PageHeader({ title, eyebrow, subtitle, actions, badge, children, size = "md", className }) {
  const titleClass = size === "lg"
    ? "text-2xl sm:text-3xl lg:text-4xl"
    : size === "sm"
      ? "text-lg sm:text-xl"
      : "text-xl sm:text-2xl lg:text-3xl";
  const barClass = size === "lg" ? "h-7 sm:h-8 lg:h-9" : size === "sm" ? "h-5 sm:h-6" : "h-6 sm:h-7 lg:h-8";

  return (
    <header className={cn("mb-5 space-y-3 sm:mb-6", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-accent">{eyebrow}</p>
          )}
          <h1 className={cn("flex min-w-0 items-center gap-2.5 break-words font-extrabold leading-tight text-white", titleClass)}>
            <span className={cn("w-1 shrink-0 rounded-full bg-gradient-to-b from-accent to-brand", barClass)} aria-hidden />
            <span className="min-w-0">{title}</span>
            {badge}
          </h1>
          {subtitle && <p className="mt-1.5 max-w-prose text-sm text-text-dim">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export default PageHeader;
