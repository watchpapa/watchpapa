// Profile banner helpers (shared by ProfileBanner + BannerPicker).

export const BANNER_ASPECT = 3; // width / height of the crop frame

// The favourite whose artwork backs the banner: the saved position, else the
// first favourite. Backdrops (16:9) are preferred over posters.
export function bannerSource(favourites, position) {
  const byPos = position ? favourites.find((f) => f.position === position) : null;
  const fav = byPos ?? favourites.find((f) => f.position === 1) ?? favourites[0] ?? null;
  if (!fav) return null;
  const media = fav.movie ?? fav.show;
  if (!media) return null;
  const path = media.backdrop_path ?? media.poster_path;
  return path ? { fav, path, isBackdrop: Boolean(media.backdrop_path), title: media.title ?? media.name } : null;
}

// Renders a % crop ({x,y,width,height} of the source image) as a CSS
// background: background-size scales the image so the crop fills the box,
// background-position slides it to the crop's origin.
export function cropStyle(url, crop) {
  if (!crop) return { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center 30%" };
  const w = Math.max(crop.width, 0.01);
  const h = Math.max(crop.height, 0.01);
  const px = crop.width >= 100 ? 50 : (crop.x / (100 - crop.width)) * 100;
  const py = crop.height >= 100 ? 50 : (crop.y / (100 - crop.height)) * 100;
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: `${(100 / w) * 100}% ${(100 / h) * 100}%`,
    backgroundPosition: `${px}% ${py}%`,
    backgroundRepeat: "no-repeat",
  };
}
