import { useEffect, useState } from "react";
import { tmdbImg } from "../../lib/tmdbImage.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const COLS = 6;
const PER_COL = 9;
const DURATIONS = [90, 110, 80, 100, 95, 115];

const KEYFRAMES = `
  @keyframes posterScrollUp {
    from { transform: translateY(0); }
    to   { transform: translateY(-50%); }
  }
  @keyframes posterScrollDown {
    from { transform: translateY(-50%); }
    to   { transform: translateY(0); }
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

function PosterBackground() {
  const [columns, setColumns] = useState([]);

  useEffect(() => {
    async function load() {
      const res = await fetch(`${API_BASE}/api/posters`).catch(() => null);
      if (!res?.ok) return;
      const { paths } = await res.json().catch(() => ({}));
      if (!paths?.length) return;

      const shuffled = shuffle(paths);
      setColumns(
        Array.from({ length: COLS }, (_, i) =>
          Array.from({ length: PER_COL }, (_, j) => shuffled[(i * PER_COL + j) % shuffled.length])
        )
      );
    }
    load();
  }, []);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {columns.length > 0 && (
          <div className="flex h-full gap-[6px] px-[3px]">
            {columns.map((col, i) => (
              <div key={i} className="min-w-0 flex-1 overflow-hidden">
                <div
                  style={{
                    animation: `posterScrollUp ${DURATIONS[i]}s linear infinite`,
                  }}
                >
                  {[...col, ...col].map((path, j) => (
                    <div key={j} className="mb-[6px] aspect-[2/3]">
                      <img
                        src={tmdbImg(path, "w185")}
                        alt=""
                        className="h-full w-full rounded-[6px] object-cover"
                        loading="lazy"
                      />
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
