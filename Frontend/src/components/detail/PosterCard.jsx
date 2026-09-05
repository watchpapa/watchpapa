import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { tmdbImg, tmdbImgProxied } from "../../lib/tmdbImage.js";

function slugify(s) {
  return (s || "poster").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "poster";
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// Full-size preview, opened by clicking the poster. The download button only
// lives here — not on the small card — so downloading is a deliberate,
// discoverable second step rather than a stray icon cluttering every card.
function PosterPreviewModal({ title, posterPath, onClose }) {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(tmdbImgProxied(posterPath, "original"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(title)}-poster.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* download failed — the preview stays open either way */
    } finally {
      setDownloading(false);
    }
  };

  // Portal straight to <body>: PosterCard lives inside DetailPageLayout's
  // `position: sticky` sidebar, which creates its own stacking context — a
  // nested `fixed z-50` never gets compared against the Navbar's own z-50 and
  // loses, so the "modal" rendered behind the page instead of above it.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img
          src={tmdbImg(posterPath, "w780")}
          alt={title}
          className="max-h-[90vh] w-auto rounded-2xl border border-[#2a3570] shadow-2xl"
        />
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur transition hover:border-white/40 hover:bg-black/80"
        >
          <CloseIcon />
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:border-white/40 hover:bg-black/80 disabled:opacity-50"
        >
          <DownloadIcon />
          {downloading ? "Downloading…" : "Download"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

// Poster used on Movie/Show/Season/Collection detail pages. Clicking it opens
// a full-size preview with a download button (goes through the Worker's
// /api/image-proxy — the raw TMDB CDN doesn't send permissive CORS headers,
// so a plain fetch().blob() of tmdbImg()'s URL would fail).
function PosterCard({ title, posterPath }) {
  const imgSrc = posterPath ? tmdbImg(posterPath, "w342") : null;
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#2a3570] bg-[#12163a] aspect-[2/3] w-full shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)]">
      {imgSrc ? (
        <button
          onClick={() => setPreviewOpen(true)}
          className="block h-full w-full cursor-zoom-in"
          aria-label={`View larger ${title} poster`}
        >
          <img src={imgSrc} alt={title} className="h-full w-full object-cover" loading="lazy" />
        </button>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#181d40] to-[#0e1128] px-4">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3a3a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="14" rx="2" />
            <path d="M8 6V4M16 6V4M2 10h20" />
          </svg>
          <span className="text-center text-sm font-medium leading-tight text-[#3a3a7a] line-clamp-4">{title}</span>
        </div>
      )}
      {previewOpen && (
        <PosterPreviewModal title={title} posterPath={posterPath} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

export default PosterCard;
