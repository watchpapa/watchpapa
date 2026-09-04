// Canvas helper for the avatar upload crop flow (components/profile/AvatarPicker.jsx).
// Takes the pixel crop rect react-easy-crop reports and renders it into a fixed
// square output, exported as a JPEG Blob ready to upload to Supabase Storage.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

// imageSrc: object URL of the picked file. pixelCrop: { x, y, width, height }
// from react-easy-crop's onCropComplete. outputSize: square side in pixels.
export async function getCroppedImageBlob(imageSrc, pixelCrop, outputSize = 512) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export the cropped image"))), "image/jpeg", 0.9);
  });
}
