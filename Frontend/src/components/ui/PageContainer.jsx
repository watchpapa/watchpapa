import { cn } from "../../lib/cn.js";

// One content width scale for every page (the app had 6 ad hoc max-widths).
//   narrow   — forms, settings, feeds        (42rem)
//   reading  — profile, single-column pages  (48rem)
//   standard — lists, watchlists, admin      (72rem)
//   wide     — poster browse pages           (1600px, 1920px on ultrawide)
//   full     — no cap
const WIDTHS = {
  narrow: "max-w-2xl",
  reading: "max-w-3xl",
  standard: "max-w-6xl",
  wide: "max-w-[1600px] 3xl:max-w-[1920px]",
  full: "max-w-none",
};

function PageContainer({ width = "standard", className, children, as: Tag = "div", ...props }) {
  return (
    <Tag className={cn("mx-auto w-full min-w-0", WIDTHS[width] ?? WIDTHS.standard, className)} {...props}>
      {children}
    </Tag>
  );
}

export default PageContainer;
