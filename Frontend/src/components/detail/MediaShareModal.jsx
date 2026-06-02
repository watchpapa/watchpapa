import { useState, useEffect } from "react";
import { useRating } from "../../features/rating/hooks/useRating.js";
import { FORMATS, generateMediaShareCard } from "./generateMediaShareCard.js";

export function MediaShareModal({ mediaType, mediaData, session, onClose }) {
  const [format, setFormat] = useState("story");
  const [detailLevel, setDetailLevel] = useState("minimal");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const { value: userRating } = useRating(mediaType, mediaData.entityId, session);

  const mergedData = { ...mediaData, userRating };

  useEffect(() => {
    const generatePreview = async () => {
      setLoading(true);
      try {
        const blob = await generateMediaShareCard(format, detailLevel, mergedData, 1);
        const url = URL.createObjectURL(blob);
        setPreview(url);
      } catch (err) {
        console.error("Failed to generate preview:", err);
      }
      setLoading(false);
    };

    generatePreview();
  }, [format, detailLevel]);

  const downloadImage = async () => {
    setLoading(true);
    try {
      const blob = await generateMediaShareCard(format, detailLevel, mergedData, 3);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watchpapa-${mediaType}-share-${format}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download:", err);
    }
    setLoading(false);
  };

  const shareToApps = async () => {
    if (!navigator.share) {
      alert("Share not supported on this device. Use Download to save and share manually.");
      return;
    }
    setLoading(true);
    try {
      const blob = await generateMediaShareCard(format, detailLevel, mergedData, 3);
      const file = new File([blob], `watchpapa-share.png`, { type: "image/png" });
      await navigator.share({ files: [file], title: `Check out this ${mediaType}` });
    } catch (err) {
      if (err.name !== "AbortError") console.error("Share failed:", err);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[#2a3570] bg-[#0d0f1e] p-6">
        <h2 className="mb-6 text-xl font-bold text-white">Share {mediaType === "movie" ? "Movie" : "Show"}</h2>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Preview */}
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-[#2a3570]/50 bg-[#0a0c18] p-3">
              {preview ? (
                <img src={preview} alt="Preview" className="w-full rounded" />
              ) : (
                <div className="aspect-[3/4] flex items-center justify-center rounded bg-[#12163a] text-[#4a4a7a]">
                  {loading ? "Generating..." : "Select format to preview"}
                </div>
              )}
            </div>
          </div>

          {/* Options & Actions */}
          <div className="flex flex-col gap-6">
            {/* Format */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-[#8383e7] mb-2">
                Format
              </label>
              <div className="flex flex-col gap-2">
                {Object.keys(FORMATS).map((key) => (
                  <button
                    key={key}
                    onClick={() => setFormat(key)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                      format === key
                        ? "border-[#6f6fdc] bg-[#6f6fdc]/20 text-[#a0a0ff]"
                        : "border-[#2a3570] bg-[#12163a] text-[#6868b8] hover:border-[#3a3a7a]"
                    }`}
                  >
                    {key === "story" && "Story (9:16)"}
                    {key === "square" && "Square (1:1)"}
                    {key === "wide" && "Wide (16:9)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Detail Level */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-[#8383e7] mb-2">
                Details
              </label>
              <div className="flex flex-col gap-2">
                {["minimal", "standard", "rich"].map((level) => (
                  <button
                    key={level}
                    onClick={() => setDetailLevel(level)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                      detailLevel === level
                        ? "border-[#c084fc] bg-[#c084fc]/20 text-[#e0a0ff]"
                        : "border-[#2a3570] bg-[#12163a] text-[#6868b8] hover:border-[#3a3a7a]"
                    }`}
                  >
                    {level === "minimal" && "Minimal"}
                    {level === "standard" && "Standard"}
                    {level === "rich" && "Rich"}
                    <span className="ml-1 text-[10px] text-[#5050a0]">
                      {level === "minimal" && " — Poster + title + rating"}
                      {level === "standard" && " — + year"}
                      {level === "rich" && " — + genres, overview"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-4 border-t border-[#2a3570]">
              <button
                onClick={downloadImage}
                disabled={loading}
                className="rounded-lg bg-[#6f6fdc] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5a5acc] disabled:opacity-50"
              >
                {loading ? "Generating..." : "Download (4K)"}
              </button>
              {navigator.share && (
                <button
                  onClick={shareToApps}
                  disabled={loading}
                  className="rounded-lg bg-[#4b3bb0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3a2a9f] disabled:opacity-50"
                >
                  Share to Apps
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg border border-[#2a3570] px-4 py-2 text-sm font-semibold text-[#8383e7] transition hover:border-[#3a3a7a] hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
