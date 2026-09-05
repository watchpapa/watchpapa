import Button from "./Button.jsx";
import { cn } from "../../lib/cn.js";

function LoadMoreButton({ onClick, loading = false, hasMore = true, label = "Load more", className }) {
  if (!hasMore) return null;
  return (
    <div className={cn("flex justify-center pt-2", className)}>
      <Button variant="outline" size="md" onClick={onClick} loading={loading} className="min-w-[10rem]">
        {loading ? "Loading…" : label}
      </Button>
    </div>
  );
}

export default LoadMoreButton;
