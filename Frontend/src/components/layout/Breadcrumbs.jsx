import { Link } from "react-router-dom";

// Padding matches AppLayout's <main> (px-3 sm:px-5 lg:px-8). Long trails
// scroll horizontally instead of wrapping under the sticky header.
function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="border-b border-border/50 bg-bg px-3 py-2 sm:px-5 lg:px-8">
      <ol className="scrollbar-none flex items-center gap-1 overflow-x-auto whitespace-nowrap text-xs">
        {items.map((item, i) => (
          <li key={i} className="flex shrink-0 items-center gap-1">
            {i > 0 && <span className="text-[#2a2a5a]" aria-hidden>›</span>}
            {item.to ? (
              <Link to={item.to} className="inline-flex min-h-7 items-center text-text-dim transition hover:text-white">{item.label}</Link>
            ) : (
              <span className="inline-flex min-h-7 max-w-[60vw] items-center truncate font-semibold text-text sm:max-w-none" aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
