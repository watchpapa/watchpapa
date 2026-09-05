import { useRef, useState } from "react";
import Cropper from "react-easy-crop";
import Avatar from "../ui/Avatar.jsx";
import Button from "../ui/Button.jsx";
import Modal from "../ui/Modal.jsx";
import MediaSearchModal from "../ui/MediaSearchModal.jsx";
import { getCroppedImageBlob } from "../../lib/cropImage.js";
import { isProTier } from "../../lib/tier.js";
import { cn } from "../../lib/cn.js";
import { FilmIcon, LockIcon, UploadIcon, UserIcon } from "../icons/index.jsx";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB raw pick; cropped output is much smaller
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const POSTER_MEDIA_TYPES = ["movie", "show"];

// Crop-and-zoom step between picking a file and uploading it.
function CropModal({ imageSrc, onCancel, onConfirm, saving }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  return (
    <Modal
      open
      onClose={saving ? () => {} : onCancel}
      title="Crop your photo"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => croppedAreaPixels && onConfirm(croppedAreaPixels)} disabled={!croppedAreaPixels} loading={saving}>Save avatar</Button>
        </div>
      }
    >
      <div className="relative h-72 w-full overflow-hidden rounded-xl bg-black sm:h-80">
        <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)} />
      </div>
      <label className="mt-4 block">
        <span className="text-xs font-semibold text-text-muted">Zoom</span>
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="mt-1 w-full accent-brand" aria-label="Zoom" />
      </label>
    </Modal>
  );
}

function OptionCard({ active, icon: Icon, title, hint, onClick, disabled, locked = false, to }) {
  const cls = cn(
    "flex min-h-[4.5rem] w-full items-center gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50 sm:flex-col sm:items-center sm:justify-center sm:text-center",
    active ? "border-brand bg-surface-3 ring-2 ring-brand/50" : "border-border/50 bg-surface hover:border-border-strong",
    locked && "opacity-70",
  );
  const inner = (
    <>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", active ? "bg-brand/25 text-brand-light" : "bg-surface-3 text-text-dim")}>
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="block text-[11px] text-text-faint">{hint}</span>
      </span>
    </>
  );
  return <Button variant="ghost" size="md" to={to} onClick={onClick} disabled={disabled} className={cn(cls, "h-auto justify-start whitespace-normal p-3 font-normal sm:justify-center")} aria-pressed={active}>{inner}</Button>;
}

// Avatar section for /profile/edit. avatar/avatarSaving/setAvatarPoster/
// uploadAvatarPhoto/setAvatarDefault come from useEditProfile(session).
function AvatarPicker({ username, tier, avatar, avatarSaving, setAvatarPoster, uploadAvatarPhoto, setAvatarDefault }) {
  const fileInputRef = useRef(null);
  const [pickingPoster, setPickingPoster] = useState(false);
  const [pickedImage, setPickedImage] = useState(null);
  const [pickError, setPickError] = useState(null);
  const canUpload = isProTier(tier);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPickError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) { setPickError("Please choose a JPEG, PNG, or WebP image."); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setPickError("That image is too large (max 8MB)."); return; }
    setPickedImage(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (pixelCrop) => {
    const blob = await getCroppedImageBlob(pickedImage, pixelCrop, 512);
    const { error } = await uploadAvatarPhoto(blob);
    if (!error) {
      URL.revokeObjectURL(pickedImage);
      setPickedImage(null);
    } else {
      setPickError(error);
    }
  };

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <Avatar username={username} avatarType={avatar.type} avatarPosterPath={avatar.posterPath} avatarUploadPath={avatar.uploadPath} size="2xl" className="mx-auto sm:mx-0" />

      <div className="min-w-0 flex-1 space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <OptionCard active={avatar.type === "default"} icon={UserIcon} title="Initials" hint="Your first letter" onClick={setAvatarDefault} disabled={avatarSaving} />
          <OptionCard active={avatar.type === "poster"} icon={FilmIcon} title="Poster" hint="Any movie or show" onClick={() => setPickingPoster(true)} disabled={avatarSaving} />
          {canUpload ? (
            <OptionCard active={avatar.type === "upload"} icon={UploadIcon} title="Photo" hint="JPEG, PNG or WebP" onClick={() => fileInputRef.current?.click()} disabled={avatarSaving} />
          ) : (
            <OptionCard icon={LockIcon} title="Photo" hint="Upload your own · Pro" to="/subscription" locked />
          )}
        </div>
        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(",")} onChange={handleFileChange} className="hidden" />
        {pickError && <p className="text-xs text-red-300">{pickError}</p>}
      </div>

      {pickingPoster && (
        <MediaSearchModal title="Search for a movie or show poster…" mediaTypes={POSTER_MEDIA_TYPES} onSelect={async (item) => { await setAvatarPoster(item); setPickingPoster(false); }} onClose={() => setPickingPoster(false)} />
      )}
      {pickedImage && (
        <CropModal imageSrc={pickedImage} saving={avatarSaving} onCancel={() => { URL.revokeObjectURL(pickedImage); setPickedImage(null); }} onConfirm={handleCropConfirm} />
      )}
    </div>
  );
}

export default AvatarPicker;
