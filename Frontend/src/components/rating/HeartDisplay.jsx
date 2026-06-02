import { useId } from "react";

// Read-only heart display.
// value: 1–10 (integers) or float for averages. null = no rating.
// size: 'sm' | 'md' | 'lg'

const SIZES = { sm: 12, md: 16, lg: 20 };
const HEART_PATH = "M8 14.7C3.8 11.2 1 8.8 1 6.1 1 4 2.7 2.4 4.8 2.4c1.1 0 2.2.5 3.2 1.8C9 2.9 10.1 2.4 11.2 2.4 13.3 2.4 15 4 15 6.1c0 2.7-2.8 5.1-7 8.6z";

function Heart({ fill, size }) {
  const px = SIZES[size] ?? SIZES.md;
  const id = useId();
  const clipId = `hc${id.replace(/:/g, "")}`;

  return (
    <svg width={px} height={px} viewBox="0 0 16 16" fill="none" className="shrink-0">
      {fill === "half" && (
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width="8" height="16" />
          </clipPath>
        </defs>
      )}
      {/* Empty outline */}
      <path d={HEART_PATH} stroke="#4a4a8a" strokeWidth="1.2" fill="none" />
      {/* Filled layer */}
      {fill === "full" && (
        <path d={HEART_PATH} fill="#a090ff" />
      )}
      {fill === "half" && (
        <path d={HEART_PATH} fill="#a090ff" clipPath={`url(#${clipId})`} />
      )}
    </svg>
  );
}

export function HeartDisplay({ value, size = "md" }) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = value >= i * 2 ? "full" : value >= i * 2 - 1 ? "half" : "empty";
        return <Heart key={i} fill={fill} size={size} />;
      })}
    </div>
  );
}
