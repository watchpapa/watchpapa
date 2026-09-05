import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Cropper from "react-easy-crop";
import Avatar from "../ui/Avatar.jsx";
import MediaSearchModal from "../ui/MediaSearchModal.jsx";
import { getCroppedImageBlob } from "../../lib/cropImage.js";
import { isProTier } from "../../lib/tier.js";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB raw pick; cropped output is much smaller
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const POSTER_MEDIA_TYPES = ["movie", "show"];

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// Full-screen crop-and-zoom step between picking a file and uploading it.
function CropModal({ imageSrc, onCancel, onConfirm, saving }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2f5a] bg-[#0d0f1e] shadow-2xl">
        <div className="border-b border-[#2a3570]/50 px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Crop your photo</h3>
        </div>
        <div className="relative h-72 w-full bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
          />
        </div>
        <div className="space-y-3 px-5 py-4">
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-[#6f6fdc]"
            aria-label="Zoom"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-[#2a3570] px-3 py-1.5 text-xs text-[#6868b8] transition hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => croppedAreaPixels && onConfirm(croppedAreaPixels)}
              disabled={saving || !croppedAreaPixels}
              className="rounded-lg border border-[#6868b8] bg-[#12163a] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#9b9bf0] hover:text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save avatar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Avatar section for /profile/edit. avatar/avatarSaving/setAvatarPoster/
// uploadAvatarPhoto/setAvatarDefault come from useEditProfile(session).
function AvatarPicker({ username, tier, avatar, avatarSaving, setAvatarPoster, uploadAvatarPhoto, setAvatarDefault }) {
  const fileInputRef = useRef(null);
  const [pickingPoster, setPickingPoster] = useState(false);
  const [pickedImage, setPickedImage] = useState(null); // object URL awaiting crop
  const [pickError, setPickError] = useState(null);
  const canUpload = isProTier(tier);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    setPickError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setPickError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setPickError("That image is too large (max 8MB).");
      return;
    }
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

  const handlePosterSelect = async (item) => {
    await setAvatarPoster(item);
    setPickingPoster(false);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <Avatar
        username={username}
        avatarType={avatar.type}
        avatarPosterPath={avatar.posterPath}
        avatarUploadPath={avatar.uploadPath}
        size="lg"
      />

      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={setAvatarDefault}
            disabled={avatarSaving}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              avatar.type === "default"
                ? "border-[#6f6fdc] bg-[#1a1d35] text-white"
                : "border-[#2a3570] bg-transparent text-[#8888c8] hover:border-[#3a3a7a] hover:text-white"
            }`}
          >
            Initials
          </button>
          <button
            onClick={() => setPickingPoster(true)}
            disabled={avatarSaving}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              avatar.type === "poster"
                ? "border-[#6f6fdc] bg-[#1a1d35] text-white"
                : "border-[#2a3570] bg-transparent text-[#8888c8] hover:border-[#3a3a7a] hover:text-white"
            }`}
          >
            Movie/show poster
          </button>
          {canUpload ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarSaving}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                avatar.type === "upload"
                  ? "border-[#6f6fdc] bg-[#1a1d35] text-white"
                  : "border-[#2a3570] bg-transparent text-[#8888c8] hover:border-[#3a3a7a] hover:text-white"
              }`}
            >
              Upload photo
            </button>
          ) : (
            <Link
              to="/subscription"
              className="flex items-center gap-1.5 rounded-xl border border-[#2a3570] bg-transparent px-3 py-1.5 text-xs font-semibold text-[#5a5a78] transition hover:border-[#3a3a7a] hover:text-[#8888c8]"
              title="Upload a custom photo — requires Pro"
            >
              <LockIcon />
              Upload photo (Pro)
            </Link>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        <p className="text-[11px] text-[#5a5a78]">
          Pick a movie or show poster as your avatar, or upgrade to Pro to upload your own photo.
        </p>
        {pickError && <p className="text-xs text-red-400">{pickError}</p>}
      </div>

      {pickingPoster && (
        <MediaSearchModal
          title="Search for a movie or show poster…"
          mediaTypes={POSTER_MEDIA_TYPES}
          onSelect={handlePosterSelect}
          onClose={() => setPickingPoster(false)}
        />
      )}
      {pickedImage && (
        <CropModal
          imageSrc={pickedImage}
          saving={avatarSaving}
          onCancel={() => { URL.revokeObjectURL(pickedImage); setPickedImage(null); }}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}

export default AvatarPicker;
