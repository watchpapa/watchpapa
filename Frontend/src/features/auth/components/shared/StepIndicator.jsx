import { cn } from "../../../../lib/cn.js";

// "1 Account — 2 About you" progress header for multi-step auth flows.
function StepIndicator({ steps, current }) {
  return (
    <ol className="mb-5 flex items-center gap-2" aria-label="Progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                state === "current" && "bg-gradient-to-b from-brand to-brand-deep text-white shadow-glow-sm",
                state === "done" && "bg-emerald-600/80 text-white",
                state === "todo" && "border border-border-strong text-text-faint",
              )}
            >
              {state === "done" ? "✓" : n}
            </span>
            <span className={cn("truncate text-xs font-semibold", state === "current" ? "text-white" : "text-text-faint")}>{label}</span>
            {i < steps.length - 1 && <span className="h-px min-w-4 flex-1 bg-border/60" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

export default StepIndicator;
