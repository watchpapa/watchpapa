import { cn } from "../../lib/cn.js";

// The one poster grid: 2 columns at 320px, 3 from 400px, then auto-fill with
// card minimums that grow with the viewport (130 → 150 → 168 → 190px).
export const POSTER_GRID_CLASS =
  "grid gap-2 xs:gap-3 grid-cols-[repeat(auto-fill,minmax(104px,1fr))] xs:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] 3xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]";

function PosterGrid({ className, children, ...props }) {
  return (
    <div className={cn(POSTER_GRID_CLASS, className)} {...props}>
      {children}
    </div>
  );
}

export default PosterGrid;
