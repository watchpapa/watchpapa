import { useState } from "react";
import Cropper from "react-easy-crop";
import Button from "../ui/Button.jsx";
import Modal from "../ui/Modal.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { cn } from "../../lib/cn.js";
import { CheckIcon, EditIcon, FilmIcon } from "../icons/index.jsx";
import ProfileBanner from "./ProfileBanner.jsx";
import { BANNER_ASPECT, bannerSource } from "../../lib/profileBanner.js";

// Crop a 3:1 band out of the chosen artwork. react-easy-crop reports the
// selection in percent of the source image (`croppedArea`), which is exactly
// what ProfileBanner renders — no pixel export, no upload.
function CropModal({ url, initialCrop, saving, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(null);
  return (
    <Modal
      open
      onClose={saving ? () => {} : onCancel}
      title="Crop your banner"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => area && onConfirm(area)} disabled={!area} loading={saving}>Save banner</Button>
        </div>
      }
    >
      <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16 / 9" }}>
        <Cropper
          image={url}
          crop={crop}
          zoom={zoom}
          aspect={BANNER_ASPECT}
          initialCroppedAreaPercentages={initialCrop ?? undefined}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(percentArea) => setArea(percentArea)}
        />
      </div>
      <label className="mt-4 block">
        <span className="text-xs font-semibold text-text-muted">Zoom</span>
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="mt-1 w-full accent-brand" aria-label="Zoom" />
      </label>
      <p className="mt-2 text-xs text-text-faint">Drag to move, pinch or use the slider to zoom. The banner shows the middle of this band on wide screens.</p>
    </Modal>
  );
}

// "Profile banner" section on /profile/edit: pick which favourite backs the
// banner (or Auto = first favourite), preview it, and crop it.
function BannerPicker({ favourites, banner, saving, onSave }) {
  const [cropping, setCropping] = useState(false);
  const slots = [1, 2, 3, 4, 5].map((pos) => favourites.find((f) => f.position === pos) ?? null);
  const src = bannerSource(favourites, banner.position);

  if (!favourites.length) {
    return <EmptyState compact icon={FilmIcon} title="Add a favourite first" description="Your banner is built from one of your five favourites." />;
  }

  const choose = (position) => onSave({ position, crop: position === banner.position ? banner.crop : null });

  return (
    <div className="space-y-4">
      <ProfileBanner favourites={favourites} position={banner.position} crop={banner.crop} className="h-28 rounded-xl border border-border/50 sm:h-36">
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
          <span className="truncate text-xs font-semibold text-white drop-shadow">{src?.title ?? "No artwork"}</span>
          {src && (
            <Button variant="secondary" size="xs" icon={EditIcon} onClick={() => setCropping(true)} disabled={saving} className="pointer-events-auto">
              {banner.crop ? "Adjust crop" : "Crop"}
            </Button>
          )}
        </div>
      </ProfileBanner>

      <div>
        <p className="mb-2 text-xs font-semibold text-text-muted">Artwork from</p>
        <div className="grid grid-cols-3 gap-2 xs:grid-cols-6">
          <button
            type="button"
            onClick={() => choose(null)}
            disabled={saving}
            aria-pressed={banner.position == null}
            className={cn(
              "flex aspect-[2/3] flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-[11px] font-semibold transition",
              banner.position == null ? "border-brand bg-surface-3 text-white ring-2 ring-brand/50" : "border-border/50 bg-surface text-text-muted hover:border-border-strong",
            )}
          >
            Auto
            <span className="text-[10px] font-normal text-text-faint">first favourite</span>
          </button>
          {slots.map((fav, i) => {
            const pos = i + 1;
            const media = fav?.movie ?? fav?.show;
            const active = banner.position === pos;
            if (!media) return <div key={pos} className="aspect-[2/3] rounded-xl border border-dashed border-border/40" aria-hidden />;
            return (
              <button
                key={pos}
                type="button"
                onClick={() => choose(pos)}
                disabled={saving}
                aria-pressed={active}
                title={media.title ?? media.name}
                className={cn("relative aspect-[2/3] overflow-hidden rounded-xl border transition", active ? "border-brand ring-2 ring-brand/50" : "border-border/50 hover:border-border-strong")}
              >
                {media.poster_path ? (
                  <img src={tmdbImg(media.poster_path, "w185")} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-border-strong"><FilmIcon size={18} /></div>
                )}
                {active && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white"><CheckIcon size={12} strokeWidth={3} /></span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-text-faint">Backdrop art is used when a title has one, otherwise its poster.</p>
      </div>

      {cropping && src && (
        <CropModal
          url={tmdbImg(src.path, src.isBackdrop ? "w1280" : "w780")}
          initialCrop={banner.crop}
          saving={saving}
          onCancel={() => setCropping(false)}
          onConfirm={async (area) => {
            const { error } = await onSave({ position: banner.position, crop: { x: area.x, y: area.y, width: area.width, height: area.height } });
            if (!error) setCropping(false);
          }}
        />
      )}
    </div>
  );
}

export default BannerPicker;
