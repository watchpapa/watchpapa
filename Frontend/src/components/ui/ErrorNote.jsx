import { cn } from "../../lib/cn.js";
import { AlertIcon } from "../icons/index.jsx";
import Button from "./Button.jsx";

function ErrorNote({ children = "Something went wrong.", onRetry, className, inline = false }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-3 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300",
        inline ? "" : "mx-auto max-w-lg",
        className,
      )}
    >
      <AlertIcon size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {onRetry && (
        <Button variant="ghost" size="xs" onClick={onRetry} className="text-red-200 hover:bg-red-900/40">
          Retry
        </Button>
      )}
    </div>
  );
}

export default ErrorNote;
