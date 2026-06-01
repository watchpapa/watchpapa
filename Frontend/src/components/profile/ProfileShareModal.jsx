import { useEffect, useState } from "react";
import { generateShareCard, FORMATS } from "./generateShareCard.js";

const FORMAT_OPTIONS = [
  { id: "story",  label: "Story",  sub: "9:16" },
  { id: "square", label: "Square", sub: "1:1"  },
  { id: "wide",   label: "Wide",   sub: "16:9" },
];

// Preview container bounds
const MAX_PREVIEW_W = 430;
const MAX_PREVIEW_H = 480;

const canWebShare = () => typeof navigator.share === "function" && typeof navigator.canShare === "function";

function XIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function DownloadIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
function ShareIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>;
}

export default function ProfileShareModal({ onClose, profile, tier, favourites, basic, genreStats, decadeStats, ownerTier }) {
  const [format, setFormat] = useState("story");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [error, setError] = useState(null);

  const cardData = { profile, tier, favourites, basic, genreStats, decadeStats };
  const hasData = !!basic;

  // WYSIWYG preview: render at scale=1 (same exact renderer, 1/3 the pixels for speed)
  useEffect(() => {
    if (!hasData) return;
    let cancelled = false;
    setPreviewLoading(true);

    generateShareCard({ format, ...cardData, scale: 1 })
      .then(canvas => {
        if (cancelled) return;
        canvas.toBlob(blob => {
          if (cancelled || !blob) return;
          setPreviewUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
          setPreviewLoading(false);
        }, "image/png");
      })
      .catch(() => { if (!cancelled) setPreviewLoading(false); });

    return () => { cancelled = true; };
  }, [format, hasData]); // regenerate on format change or when data first loads

  // Cleanup blob URL on unmount
  useEffect(() => () => { setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; }); }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Download/share at full 3× 4K quality
  async function getHiResBlob() {
    const canvas = await generateShareCard({ format, ...cardData, scale: 3 });
    return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  }

  async function handleShare() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const blob = await getHiResBlob();
      const file = new File([blob], `${profile.username}-watchpapa.png`, { type: "image/png" });
      if (canWebShare() && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${profile.username} on watchpapa`, text: "Check out my film taste on watchpapa!" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = `${profile.username}-watchpapa.png`; a.href = url; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if (e?.name !== "AbortError") setError("Share failed. Try downloading instead.");
    } finally { setBusy(false); }
  }

  async function handleDownload() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const blob = await getHiResBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = `${profile.username}-watchpapa.png`; a.href = url; a.click();
      URL.revokeObjectURL(url);
    } catch { setError("Download failed. Try again."); }
    finally { setBusy(false); }
  }

  // Preview display dimensions — fit card within preview box
  const { width: cardW, height: cardH } = FORMATS[format];
  const previewScale = Math.min(MAX_PREVIEW_W / cardW, MAX_PREVIEW_H / cardH);
  const displayW = Math.round(cardW * previewScale);
  const displayH = Math.round(cardH * previewScale);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-3 py-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border border-[#1a1f3a] bg-[#0a0c18] shadow-2xl overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 48px)" }}
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Share profile"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1a1f3a] px-5 py-4">
          <div>
            <p className="text-sm font-bold text-white">Share Profile</p>
            <p className="text-xs text-[#4a4a7a]">@{profile.username}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5050a0] transition hover:bg-[#1a1f3a] hover:text-white">
            <XIcon />
          </button>
        </div>

        {/* Format pills */}
        <div className="flex gap-2 px-5 py-3" style={{ scrollbarWidth: "none" }}>
          {FORMAT_OPTIONS.map(({ id, label, sub }) => (
            <button
              key={id}
              onClick={() => setFormat(id)}
              className={`flex shrink-0 flex-col items-center rounded-xl border px-4 py-2 text-xs font-semibold transition
                ${format === id ? "border-[#5a5aaa] bg-[#1a1d35] text-white" : "border-[#1a1f3a] text-[#5050a0] hover:border-[#3a3a7a] hover:text-[#a0a0e8]"}`}
            >
              <span>{label}</span>
              <span className={`text-[10px] font-normal ${format === id ? "text-[#8080c0]" : "text-[#3a3a6a]"}`}>{sub}</span>
            </button>
          ))}
        </div>

        {/* WYSIWYG Preview — this IS the output, just at 1x scale */}
        <div className="px-5 pb-4">
          <div className="mx-auto flex items-center justify-center" style={{ width: MAX_PREVIEW_W, height: MAX_PREVIEW_H }}>
            {previewLoading ? (
              <div className="flex flex-col items-center gap-3 text-[#3a3a6a]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3a3a7a] border-t-[#8080c0]" />
                <span className="text-xs">Generating preview…</span>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Profile card preview"
                style={{ width: displayW, height: displayH, borderRadius: 12, display: "block" }}
              />
            ) : (
              <span className="text-xs text-[#3a3a6a]">Preview unavailable</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 px-5 pb-5">
          {/* Share to Instagram / Stories — Web Share API on mobile, download fallback on desktop */}
          <button
            onClick={handleShare}
            disabled={busy || !hasData}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#4040b0] bg-[#1a1040] py-3 text-sm font-bold text-[#a090ff] transition hover:border-[#6050c0] hover:bg-[#220d55] hover:text-white disabled:opacity-50"
          >
            <ShareIcon />
            {busy ? "Generating…" : "Share to Instagram / Stories"}
          </button>

          {/* Download PNG */}
          <button
            onClick={handleDownload}
            disabled={busy || !hasData}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2a2f5a] bg-[#0d0f1e] py-2.5 text-sm font-semibold text-[#8383e7] transition hover:border-[#5a5aaa] hover:text-white disabled:opacity-50"
          >
            <DownloadIcon />
            Download PNG
          </button>

          {error && <p className="text-center text-xs text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
