import { cn } from "../../lib/cn.js";

// Section heading with the gradient accent bar (MediaRow / MediaGrid style).
function SectionTitle({ as: Tag = "h2", children, count, action, className, size = "md" }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <Tag className={cn("flex min-w-0 items-center font-bold text-white", size === "lg" ? "text-lg sm:text-xl" : "text-base sm:text-lg")}>
        <span className={cn("mr-2.5 w-1 shrink-0 rounded-full bg-gradient-to-b from-accent to-brand", size === "lg" ? "h-6" : "h-5")} aria-hidden />
        <span className="truncate">{children}</span>
        {count != null && <span className="ml-2 shrink-0 text-sm font-semibold text-text-faint">{count}</span>}
      </Tag>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default SectionTitle;
