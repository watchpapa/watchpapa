import { useEffect, useState } from "react";
import { cn } from "../../lib/cn.js";

// Section jump-links: a sticky vertical list at lg+, a horizontally
// scrollable chip strip below. Highlights the section currently in view.
function SettingsNav({ sections }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  const linkClass = (id) =>
    cn(
      "block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
      active === id ? "bg-surface-2 text-white" : "text-text-muted hover:bg-surface-2/60 hover:text-white",
    );

  return (
    <nav aria-label="Settings sections" className="lg:sticky lg:top-20">
      <ul className="scrollbar-none -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 sm:-mx-5 sm:px-5 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
        {sections.map((s) => (
          <li key={s.id} className="shrink-0">
            <a href={`#${s.id}`} className={cn(linkClass(s.id), s.danger && "text-red-400 hover:text-red-300")} aria-current={active === s.id ? "true" : undefined}>
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default SettingsNav;
