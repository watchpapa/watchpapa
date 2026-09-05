import { cn } from "../../lib/cn.js";

// A settings card. `id` is the anchor the side nav scrolls to.
function SettingsSection({ id, title, description, children, className, danger = false }) {
  return (
    <section id={id} className={cn("scroll-mt-24 rounded-2xl border bg-surface", danger ? "border-red-900/50" : "border-border/50", className)}>
      <header className={cn("border-b px-4 py-3 sm:px-5 sm:py-4", danger ? "border-red-900/40" : "border-border/50")}>
        <h2 className={cn("text-sm font-semibold uppercase tracking-widest", danger ? "text-red-400" : "text-text-dim")}>{title}</h2>
        {description && <p className="mt-1 text-xs text-text-faint">{description}</p>}
      </header>
      <div className="divide-y divide-border/40">{children}</div>
    </section>
  );
}

export default SettingsSection;
