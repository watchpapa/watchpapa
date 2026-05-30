import { useRef, useState } from "react";

// Interactive heart rating input.
// Hover over left half of heart i → preview 2i-1; right half → preview 2i.
// Click to confirm. Props: value (1–10 | null), onChange(v: 1–10).

const HEART_PATH = "M8 14.7C3.8 11.2 1 8.8 1 6.1 1 4 2.7 2.4 4.8 2.4c1.1 0 2.2.5 3.2 1.8C9 2.9 10.1 2.4 11.2 2.4 13.3 2.4 15 4 15 6.1c0 2.7-2.8 5.1-7 8.6z";
const SIZE = 24;

function InteractiveHeart({ index, displayValue, onMouseMove, onClick, onMouseLeave }) {
  const fill = displayValue >= index * 2 ? "full" : displayValue >= index * 2 - 1 ? "half" : "empty";
  const clipId = `ri-clip-${index}`;

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 16 16"
      fill="none"
      className="cursor-pointer shrink-0 transition-transform hover:scale-110"
      onMouseMove={(e) => onMouseMove(e, index)}
      onMouseLeave={onMouseLeave}
      onClick={(e) => onClick(e, index)}
    >
      <defs>
        <clipPath id={clipId}><rect x="0" y="0" width="8" height="16" /></clipPath>
      </defs>
      <path d={HEART_PATH} stroke={fill === "empty" ? "#4a4a8a" : "#a090ff"} strokeWidth="1.2" fill="none" />
      {fill === "full" && <path d={HEART_PATH} fill="#a090ff" />}
      {fill === "half" && <path d={HEART_PATH} fill="#a090ff" clipPath={`url(#${clipId})`} />}
    </svg>
  );
}

export function RatingInput({ value, onChange }) {
  const [preview, setPreview] = useState(null);
  const containerRef = useRef(null);

  const displayValue = preview ?? value ?? 0;

  const handleMouseMove = (e, heartIndex) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeftHalf = x < rect.width / 2;
    setPreview(isLeftHalf ? heartIndex * 2 - 1 : heartIndex * 2);
  };

  const handleClick = (e, heartIndex) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeftHalf = x < rect.width / 2;
    const newVal = isLeftHalf ? heartIndex * 2 - 1 : heartIndex * 2;
    onChange(newVal);
  };

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-1"
      onMouseLeave={() => setPreview(null)}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <InteractiveHeart
          key={i}
          index={i}
          displayValue={displayValue}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onMouseLeave={() => {}}
        />
      ))}
      <span className="ml-2 min-w-[2.5rem] text-sm font-semibold text-[#a090ff]">
        {preview != null ? `${preview}/10` : value != null ? `${value}/10` : ""}
      </span>
    </div>
  );
}
