import { useEffect, useState } from "react";
import { generateShareCard, FORMATS } from "./generateShareCard.js";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import PillTabs from "../ui/PillTabs.jsx";
import { ShareIcon, DownloadIcon } from "../icons/index.jsx";

const FORMAT_OPTIONS = [
  { value: "story", label: "Story", hint: "9:16" },
  { value: "square", label: "Square", hint: "1:1" },
  { value: "wide", label: "Wide", hint: "16:9" },
];

// Preview container bounds — large enough to actually read the card, not a thumbnail.
const MAX_PREVIEW_W = 420;
const MAX_PREVIEW_H = 560;

const canWebShare = () => typeof navigator.share === "function" && typeof navigator.canShare === "function";

export default function ProfileShareModal({ onClose, profile, tier, favourites, basic, genreStats, decadeStats }) {
  const [format, setFormat] = useState("story");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [error, setError] = useState(null);

  const cardData = { profile, tier, favourites, basic, genreStats, decadeStats };
  const hasData = !!basic;

  // WYSIWYG preview: render at scale=1 (same exact renderer, 1/9th the pixels for speed)
  useEffect(() => {
    if (!hasData) return undefined;
    let cancelled = false;
    // Deferred a tick so this isn't a synchronous setState in the effect
    // body — generateShareCard's own image-loading work takes far longer
    // than a microtask, so the spinner still appears effectively immediately.
    Promise.resolve().then(() => { if (!cancelled) setPreviewLoading(true); });

    generateShareCard({ format, ...cardData, scale: 1 })
      .then((canvas) => {
        if (cancelled) return;
        canvas.toBlob((blob) => {
          if (cancelled || !blob) return;
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
          setPreviewLoading(false);
        }, "image/png");
      })
      .catch(() => { if (!cancelled) setPreviewLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, hasData]);

  useEffect(() => () => { setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; }); }, []);

  // Download/share at full 3x quality
  async function getHiResBlob() {
    const canvas = await generateShareCard({ format, ...cardData, scale: 3 });
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function handleShare() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await getHiResBlob();
      const file = new File([blob], `${profile.username}-watchpapa.png`, { type: "image/png" });
      if (canWebShare() && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${profile.username} on watchpapa`, text: "Check out my film taste on watchpapa!" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = `${profile.username}-watchpapa.png`;
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if (e?.name !== "AbortError") setError("Share failed. Try downloading instead.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await getHiResBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = `${profile.username}-watchpapa.png`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Preview display dimensions — fit card within preview box
  const { width: cardW, height: cardH } = FORMATS[format];
  const previewScale = Math.min(MAX_PREVIEW_W / cardW, MAX_PREVIEW_H / cardH);
  const displayW = Math.round(cardW * previewScale);
  const displayH = Math.round(cardH * previewScale);

  return (
    <Modal open onClose={onClose} title="Share profile" size="lg">
      <div className="flex flex-col gap-5">
        <PillTabs aria-label="Card format" tabs={FORMAT_OPTIONS.map((f) => ({ ...f, label: `${f.label} · ${f.hint}` }))} value={format} onChange={setFormat} size="md" fill />

        {/* WYSIWYG preview — this IS the output, just at 1x scale */}
        <div className="mx-auto flex w-full items-center justify-center" style={{ minHeight: 160, maxHeight: MAX_PREVIEW_H }}>
          {previewLoading ? (
            <div className="flex flex-col items-center gap-3 text-text-faint">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-brand-light" />
              <span className="text-xs">Generating preview…</span>
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Profile card preview"
              className="block max-h-[560px] w-full max-w-full rounded-xl border border-border object-contain shadow-lg shadow-black/30"
              style={{ aspectRatio: `${displayW} / ${displayH}`, maxWidth: MAX_PREVIEW_W }}
            />
          ) : (
            <span className="text-xs text-text-faint">Preview unavailable</span>
          )}
        </div>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        <div className="flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row-reverse">
          <Button variant="primary" size="lg" full icon={ShareIcon} loading={busy} disabled={!hasData} onClick={handleShare}>
            Share
          </Button>
          <Button variant="secondary" size="lg" full icon={DownloadIcon} loading={busy} disabled={!hasData} onClick={handleDownload}>
            Download
          </Button>
        </div>
      </div>
    </Modal>
  );
}
