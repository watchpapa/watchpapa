import { cn } from "../../lib/cn.js";

function EmptyState({ icon: Icon, title, description, action, className, compact = false }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8" : "py-14 sm:py-20", className)}>
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-surface text-text-dim">
          <Icon size={22} />
        </div>
      )}
      {title && <p className="text-base font-semibold text-text">{title}</p>}
      {description && <p className="mt-1 max-w-sm text-sm text-text-faint">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
