// Converts a string to a URL-safe slug: lowercase, unaccented, hyphens.
export function slugify(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function movieSlug(title, releaseDate) {
  const base = slugify(title);
  const year = typeof releaseDate === "string" && releaseDate.length >= 4 ? releaseDate.slice(0, 4) : null;
  return year ? `${base}-${year}` : base;
}

export function showSlug(name, firstAirDate) {
  const base = slugify(name);
  const year = typeof firstAirDate === "string" && firstAirDate.length >= 4 ? firstAirDate.slice(0, 4) : null;
  return year ? `${base}-${year}` : base;
}

export function personSlug(name) {
  return slugify(name);
}
