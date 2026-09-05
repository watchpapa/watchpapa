import { cn } from "../../lib/cn.js";

export function StatCard({ label, value, sub, accent = false, tone, className }) {
  return (
    <div className={cn("rounded-xl border bg-surface-2/60 px-4 py-3", accent ? "border-brand/50" : "border-border/50", className)}>
      <p className="text-[10px] uppercase tracking-wider text-text-faint">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone ?? "text-white")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-faint">{sub}</p>}
    </div>
  );
}

export function StatGrid({ children, className }) {
  return <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>{children}</div>;
}

export default StatCard;
