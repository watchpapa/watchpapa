import { useState, useEffect } from "react";
import { useRating } from "../../features/rating/hooks/useRating.js";
import { generateMediaShareCard } from "./generateMediaShareCard.js";

export function MediaShareModal({ mediaType, mediaData, session, onClose }) {
  const [detailLevel, setDetailLevel] = useState("rich");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const format = "story";

  const { value: userRating } = useRating(mediaType, mediaData.entityId, session);

  const mergedData = { ...mediaData, userRating, username: session?.user?.user_metadata?.username || "user" };

  useEffect(() => {
    const generatePreview = async () => {
      try {
        const blob = await generateMediaShareCard(format, detailLevel, mergedData, 1);
        const url = URL.createObjectURL(blob);
        setPreview(url);
      } catch (err) {
        console.error("Failed to generate preview:", err);
      }
    };

    generatePreview();
  }, [detailLevel, mergedData]);

  const downloadImage = async () => {
    setLoading(true);
    try {
      const blob = await generateMediaShareCard(format, detailLevel, mergedData, 3);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${mediaData.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-watchpapa.png`;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#2a3570] bg-[#0d0f1e] p-4 sm:max-w-2xl sm:p-6">
        <h2 className="mb-4 text-lg font-bold text-white sm:mb-6 sm:text-xl">Share {mediaType === "movie" ? "Movie" : "Show"}</h2>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Preview */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="rounded-lg border border-[#2a3570]/50 bg-[#0a0c18] p-2 sm:p-3">
              {preview ? (
                <img src={preview} alt="Preview" className="w-full rounded" />
              ) : (
                <div className="aspect-[3/4] flex items-center justify-center rounded bg-[#12163a] text-sm text-[#4a4a7a]">
                  Loading preview...
                </div>
              )}
            </div>
          </div>

          {/* Options & Actions */}
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Detail Level */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-[#8383e7] mb-2">
                Details
              </label>
              <div className="flex flex-col gap-1.5 sm:gap-2">
                {["minimal", "standard", "rich"].map((level) => (
                  <button
                    key={level}
                    onClick={() => setDetailLevel(level)}
                    className={`rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition sm:px-3 sm:py-2 ${
                      detailLevel === level
                        ? "border-[#c084fc] bg-[#c084fc]/20 text-[#e0a0ff]"
                        : "border-[#2a3570] bg-[#12163a] text-[#6868b8] hover:border-[#3a3a7a]"
                    }`}
                  >
                    <span className="block sm:inline">{level === "minimal" && "Minimal"}{level === "standard" && "Standard"}{level === "rich" && "Rich"}</span>
                    <span className="hidden text-[10px] text-[#5050a0] sm:inline sm:ml-1">
                      {level === "minimal" && " — Poster + title + rating"}
                      {level === "standard" && " — + year"}
                      {level === "rich" && " — + genres, overview"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-3 border-t border-[#2a3570] sm:pt-4">
              <button
                onClick={downloadImage}
                disabled={loading}
                className="rounded-lg bg-[#6f6fdc] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#5a5acc] disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
              >
                {loading ? "Generating..." : "Download"}
              </button>
              {navigator.share && (
                <button
                  onClick={shareToApps}
                  disabled={loading}
                  className="rounded-lg bg-[#4b3bb0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3a2a9f] disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
                >
                  Share to Apps
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg border border-[#2a3570] px-3 py-2 text-xs font-semibold text-[#8383e7] transition hover:border-[#3a3a7a] hover:text-white sm:px-4 sm:py-2 sm:text-sm"
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
