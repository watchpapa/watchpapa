import { Link } from "react-router-dom";

function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav className="border-b border-[#1a1f3a] bg-[#0a0c18] px-5 py-2 lg:px-8">
      <ol className="flex flex-wrap items-center gap-1 text-xs">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-[#2a2a5a]">›</span>}
            {item.to ? (
              <Link to={item.to} className="text-[#6868b8] transition hover:text-white">
                {item.label}
              </Link>
            ) : (
              <span className="font-semibold text-[#c0c0e8]">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
