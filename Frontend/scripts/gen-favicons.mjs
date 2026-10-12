// Generates the favicon/PWA icon set + site.webmanifest from public/logo_v3.1.svg.
// Run locally (`node scripts/gen-favicons.mjs`); outputs are committed.
// Not part of the build — do not wire this into CI.
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "..", "public");
const SVG = path.join(PUBLIC, "logo_v3.1.svg");

async function png(size, file) {
  const svg = await readFile(SVG);
  const buf = await sharp(svg).resize(size, size).png().toBuffer();
  await writeFile(path.join(PUBLIC, file), buf);
  return buf;
}

const favicon16 = await png(16, "favicon-16x16.png");
const favicon32 = await png(32, "favicon-32x32.png");
await png(96, "favicon-96x96.png");
await png(180, "apple-touch-icon.png");
await png(192, "icon-192.png");
await png(512, "icon-512.png");

// Maskable icon needs safe-area padding (~20%) so platform UI doesn't clip the mark.
const maskableSvg = await readFile(SVG);
const maskable = await sharp({ create: { width: 512, height: 512, channels: 4, background: "#111320" } })
  .composite([{ input: await sharp(maskableSvg).resize(320, 320).png().toBuffer(), gravity: "center" }])
  .png()
  .toBuffer();
await writeFile(path.join(PUBLIC, "icon-512-maskable.png"), maskable);

const ico = await pngToIco([favicon16, favicon32]);
await writeFile(path.join(PUBLIC, "favicon.ico"), ico);

const manifest = {
  name: "watchpapa",
  short_name: "watchpapa",
  description: "Discover and track films, shows, and people.",
  start_url: "/",
  display: "standalone",
  background_color: "#111320",
  theme_color: "#111320",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
await writeFile(path.join(PUBLIC, "site.webmanifest"), JSON.stringify(manifest, null, 2) + "\n");

console.log("wrote favicon set + site.webmanifest");
