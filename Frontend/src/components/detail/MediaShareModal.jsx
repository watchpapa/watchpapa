import { useEffect, useState } from "react";
import { useRating } from "../../features/rating/hooks/useRating.js";
import { generateMediaShareCard } from "./generateMediaShareCard.js";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import PillTabs from "../ui/PillTabs.jsx";
import { ShareIcon, DownloadIcon } from "../icons/index.jsx";

const LEVELS = [
  { value: "minimal", label: "Minimal", hint: "Poster · title · rating" },
  { value: "standard", label: "Standard", hint: "+ year" },
  { value: "rich", label: "Rich", hint: "+ genres" },
];

// Story-format (9:16) share card for a movie/show — WYSIWYG preview at 1x,
// downloaded/shared at 3x. See generateMediaShareCard.js for the canvas
// template; this component is only the chrome around it.
export function MediaShareModal({ mediaType, mediaData, session, onClose }) {
  const [detailLevel, setDetailLevel] = useState("rich");
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const format = "story";

  const { value: userRating } = useRating(mediaType, mediaData.entityId, session);
  const mergedData = { ...mediaData, mediaType, userRating, username: session?.user?.user_metadata?.username || "user" };

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const blob = await generateMediaShareCard(format, detailLevel, mergedData, 1, caption);
        if (cancelled) return;
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      } catch (err) {
        console.error("Failed to generate preview:", err);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailLevel, caption, mergedData.userRating]);

  useEffect(() => () => { setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; }); }, []);

  async function getHiResBlob() {
    return generateMediaShareCard(format, detailLevel, mergedData, 3, caption);
  }

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await getHiResBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${mediaData.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-watchpapa.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await getHiResBlob();
      const file = new File([blob], "watchpapa-share.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Check out this ${mediaType} on watchpapa` });
      } else {
        await handleDownload();
      }
    } catch (err) {
      if (err?.name !== "AbortError") setError("Share failed. Try downloading instead.");
    } finally {
      setBusy(false);
    }
  }

  const canWebShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <Modal open onClose={onClose} title={`Share ${mediaType === "movie" ? "movie" : "show"}`} size="xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* WYSIWYG preview — this IS the output, just rendered at 1x. Sized
            large enough to actually read the poster/title, not a thumbnail. */}
        <div className="mx-auto w-full max-w-[360px] lg:mx-0">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-2 p-2 shadow-lg shadow-black/30">
            {previewLoading && !preview ? (
              <div className="flex aspect-[9/16] items-center justify-center rounded-xl bg-surface-3 text-xs text-text-faint">
                Generating preview…
              </div>
            ) : preview ? (
              <img src={preview} alt="Share card preview" className="w-full rounded-xl" />
            ) : (
              <div className="flex aspect-[9/16] items-center justify-center rounded-xl bg-surface-3 text-xs text-text-faint">
                Preview unavailable
              </div>
            )}
          </div>
        </div>

        {/* Options & actions */}
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-text-faint">Details</p>
            <PillTabs
              aria-label="Detail level"
              tabs={LEVELS}
              value={detailLevel}
              onChange={setDetailLevel}
              size="md"
            />
            <p className="mt-1.5 text-xs text-text-faint">{LEVELS.find((l) => l.value === detailLevel)?.hint}</p>
          </div>

          <div>
            <label htmlFor="share-caption" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-text-faint">
              Add a thought <span className="normal-case text-text-faint/70">(optional)</span>
            </label>
            <textarea
              id="share-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={125}
              rows={2}
              placeholder="A short thought about this one…"
              className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-text-faint focus:border-brand focus:outline-none"
            />
            <span className="block text-right text-[11px] text-text-faint">{caption.length}/125</span>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="mt-auto flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row-reverse">
            <Button variant="primary" size="lg" full icon={DownloadIcon} loading={busy} onClick={handleDownload}>
              Download
            </Button>
            {canWebShare && (
              <Button variant="secondary" size="lg" full icon={ShareIcon} loading={busy} onClick={handleShare}>
                Share
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
