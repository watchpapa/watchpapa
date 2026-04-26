import { useRef } from "react";
import MediaCard from "./MediaCard.jsx";

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function MediaRow({ title, items }) {
  const scrollRef = useRef(null);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -480, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 480, behavior: "smooth" });
  };

  return (
    <section>
      <h2 className="mb-3 text-xl font-extrabold tracking-tight" style={{ color: "#e8c04a" }}>
        {title}
      </h2>

      <div className="relative flex items-center">
        <button
          onClick={scrollLeft}
          aria-label="Scroll left"
          className="mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#2a3570] bg-[#141728] text-[#8888c8] transition hover:border-[#5050a0] hover:text-white"
        >
          <ChevronLeft />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => (
            <MediaCard key={item.id} {...item} />
          ))}
        </div>

        <button
          onClick={scrollRight}
          aria-label="Scroll right"
          className="ml-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#2a3570] bg-[#141728] text-[#8888c8] transition hover:border-[#5050a0] hover:text-white"
        >
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}

export default MediaRow;
