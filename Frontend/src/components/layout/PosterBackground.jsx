import { useEffect, useState } from "react";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { API_BASE } from "../../lib/api.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";

const PER_COL = 9;
const DURATIONS = [90, 110, 80, 100, 95, 115, 105, 85];

const KEYFRAMES = `
  @keyframes posterScrollUp {
    from { transform: translateY(0); }
    to   { transform: translateY(-50%); }
  }
`;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Slowly scrolling poster wall behind the auth pages. Column count follows the
// viewport (3 on phones, 4 on tablets, 6 on desktop, 8 on ultrawide) so posters
// stay recognisable instead of becoming 50px slivers; paused for users who
// prefer reduced motion.
function PosterBackground() {
  const [paths, setPaths] = useState([]);
  const sm = useMediaQuery("(min-width: 640px)");
  const lg = useMediaQuery("(min-width: 1024px)");
  const xxl = useMediaQuery("(min-width: 1920px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const cols = xxl ? 8 : lg ? 6 : sm ? 4 : 3;

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/posters`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (active && json?.paths?.length) setPaths(shuffle(json.paths)); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const columns = paths.length
    ? Array.from({ length: cols }, (_, i) => Array.from({ length: PER_COL }, (_, j) => paths[(i * PER_COL + j) % paths.length]))
    : [];

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        {columns.length > 0 && (
          <div className="flex h-full gap-1.5 px-1">
            {columns.map((col, i) => (
              <div key={i} className="min-w-0 flex-1 overflow-hidden">
                <div style={{ animation: reducedMotion ? "none" : `posterScrollUp ${DURATIONS[i % DURATIONS.length]}s linear infinite` }}>
                  {[...col, ...col].map((path, j) => (
                    <div key={j} className="mb-1.5 aspect-[2/3]">
                      <img src={tmdbImg(path, "w185")} alt="" className="h-full w-full rounded-md object-cover" loading="lazy" decoding="async" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="absolute inset-0 bg-[#0c1026]/85 backdrop-blur-[10px]" />
      </div>
    </>
  );
}

export default PosterBackground;
