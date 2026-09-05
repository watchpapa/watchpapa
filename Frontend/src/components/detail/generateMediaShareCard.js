// Canvas-based share card for a single movie/show. Story format (9:16) only —
// see profile/generateShareCard.js for the richer multi-format profile card,
// whose drawing conventions (rr, drawBg, badges, dotted footer) this mirrors
// for visual consistency between the two.

export const FORMATS = {
  story: { width: 1080, height: 1920 },
};

const TYPE_STYLE = {
  movie: { bg: "#241a06", border: "#5a4210", text: "#e8c04a", label: "MOVIE" },
  show: { bg: "#04182a", border: "#123a5a", text: "#7eb8f7", label: "SHOW" },
};

function loadImg(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function drawBg(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w * 0.55, h);
  g.addColorStop(0, "#0e1028");
  g.addColorStop(0.55, "#0a0c18");
  g.addColorStop(1, "#080918");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const orb = ctx.createRadialGradient(w * 1.05, -h * 0.1, 0, w * 1.05, -h * 0.1, w * 0.6);
  orb.addColorStop(0, "rgba(100,80,200,0.16)");
  orb.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = orb;
  ctx.fillRect(0, 0, w, h);
}

// Pill badge, left-anchored at x, vertically centered on midY. Returns width
// so callers can lay out a centered row of several badges.
function drawBadge(ctx, text, x, midY, style, fontSize) {
  ctx.font = `800 ${fontSize}px 'Inter','Helvetica Neue',Arial,sans-serif`;
  const tw = ctx.measureText(text).width;
  const hp = fontSize * 0.75, vp = fontSize * 0.42;
  const bw = tw + hp * 2, bh = fontSize + vp * 2, by = midY - bh / 2;
  ctx.fillStyle = style.bg;
  rr(ctx, x, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 1;
  rr(ctx, x, by, bw, bh, bh / 2);
  ctx.stroke();
  ctx.fillStyle = style.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + bw / 2, midY + fontSize * 0.04);
  return bw;
}

// Lay out badges centered as a row; each entry is [text, style, fontSize].
function drawBadgeRow(ctx, badges, centerX, midY, gap) {
  const widths = badges.map(([text, , fs]) => {
    ctx.font = `800 ${fs}px 'Inter','Helvetica Neue',Arial,sans-serif`;
    const tw = ctx.measureText(text).width;
    return tw + fs * 0.75 * 2;
  });
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (badges.length - 1);
  let x = centerX - totalW / 2;
  badges.forEach(([text, style, fs]) => {
    const w = drawBadge(ctx, text, x, midY, style, fs);
    x += w + gap;
  });
}

function drawHearts(ctx, value, x, y, size, spacing) {
  if (!value) return;
  const heartPath = "M8 14.7C3.8 11.2 1 8.8 1 6.1 1 4 2.7 2.4 4.8 2.4c1.1 0 2.2.5 3.2 1.8C9 2.9 10.1 2.4 11.2 2.4 13.3 2.4 15 4 15 6.1c0 2.7-2.8 5.1-7 8.6z";
  for (let i = 1; i <= 5; i++) {
    const fill = value >= i * 2 ? "full" : value >= i * 2 - 1 ? "half" : "empty";
    const sx = x + (i - 1) * (size + spacing);
    ctx.save();
    ctx.translate(sx, y);
    ctx.scale(size / 16, size / 16);
    if (fill === "empty") {
      ctx.strokeStyle = "#4a4a8a";
      ctx.lineWidth = 1.2;
      ctx.stroke(new Path2D(heartPath));
    } else if (fill === "full") {
      ctx.fillStyle = "#a090ff";
      ctx.fill(new Path2D(heartPath));
    } else {
      ctx.beginPath();
      ctx.moveTo(8, 14.7);
      ctx.bezierCurveTo(3.8, 11.2, 1, 8.8, 1, 6.1);
      ctx.bezierCurveTo(1, 4, 2.7, 2.4, 4.8, 2.4);
      ctx.bezierCurveTo(5.9, 2.4, 7, 2.9, 8, 4.2);
      ctx.lineTo(8, 14.7);
      ctx.closePath();
      ctx.fillStyle = "#a090ff";
      ctx.fill();
    }
    ctx.restore();
  }
}

// Greedy word-wrap; returns as many lines as needed.
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Truncate with a trailing ellipsis (never a bare mid-word cut).
function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function drawFooter(ctx, width, height, pad, fontSize) {
  const text = "watchpapa.tv";
  ctx.font = `600 ${fontSize}px 'Inter','Helvetica Neue',Arial,sans-serif`;
  ctx.fillStyle = "#2a2f5a";
  const fy = height - pad + fontSize * 0.2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, fy);
  const tw = ctx.measureText(text).width;
  [width / 2 - tw / 2 - 14, width / 2 + tw / 2 + 14].forEach((cx) => {
    ctx.beginPath();
    ctx.arc(cx, fy, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Every section below the poster has a deterministic height (title is capped
// at 2 lines, everything else is fixed), computed up front. The poster is
// the one elastic element — it gets whatever's left — so the layout can
// never overflow the canvas's fixed 1080x1920 regardless of title length,
// caption length, or which detail level is picked.
function layoutStory(ctx, d) {
  const { width, height, title, posterImg, userRating, year, mediaType, genres, logoImg, detailLevel, username, caption } = d;
  const pad = 64, innerW = width - pad * 2;
  drawBg(ctx, width, height);

  const logoH = 44, headerGap = 30;
  const footerH = 60;
  const posterGapAfter = 32;

  // Caption card — measured now so its height can be reserved.
  const captionLines = caption?.trim() ? (() => {
    ctx.font = "italic 500 28px Inter,sans-serif";
    return wrapLines(ctx, `"${caption.trim()}"`, innerW - 64).slice(0, 3);
  })() : [];
  const captionLineH = 38;
  const captionH = captionLines.length > 0 ? captionLines.length * captionLineH + 44 + 28 : 0;

  // Title — wrap now (font must match what's used to draw it below).
  ctx.font = "800 56px Inter,sans-serif";
  const titleLines = wrapLines(ctx, title, innerW).slice(0, 2);
  if (titleLines.length === 2) titleLines[1] = ellipsize(ctx, titleLines[1], innerW);
  const titleLH = 64;

  const badgeRowH = 56;
  const genreRowH = detailLevel === "rich" && genres?.length > 0 ? 54 : 0;
  const dividerGapH = 44;
  const ratingH = userRating != null ? 168 : 56;
  const belowPosterH = badgeRowH + titleLines.length * titleLH + 24 + genreRowH + dividerGapH + ratingH;

  let y = pad;

  // Header — banner logo, centered
  const logoW = logoImg ? logoImg.naturalWidth * (logoH / logoImg.naturalHeight) : 0;
  if (logoImg) ctx.drawImage(logoImg, (width - logoW) / 2, y, logoW, logoH);
  y += logoH + headerGap;

  // Caption, as a quote card — a plain centered line felt like an
  // afterthought; a bordered card matches how the rest of the share/profile
  // cards present secondary text.
  if (captionLines.length > 0) {
    const cardH = captionH - 28;
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    rr(ctx, pad, y, innerW, cardH, 20);
    ctx.fill();
    ctx.strokeStyle = "#1a1f3a";
    ctx.lineWidth = 1;
    rr(ctx, pad, y, innerW, cardH, 20);
    ctx.stroke();
    ctx.font = "italic 500 28px Inter,sans-serif";
    ctx.fillStyle = "#a0a0cc";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    captionLines.forEach((line, i) => ctx.fillText(line, width / 2, y + 22 + i * captionLineH));
    y += captionH;
  }

  // Poster — object-cover into a rounded frame, sized to fill exactly
  // whatever vertical space is left once every section below it is
  // accounted for. Capped at a natural 2:3-ish ratio so a very short
  // title/caption combo doesn't stretch it absurdly tall.
  const posterTop = y;
  const posterMaxH = height - footerH - belowPosterH - posterTop - posterGapAfter;
  const posterH = Math.max(120, Math.min(innerW * 1.5, posterMaxH));
  const posterW = innerW;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = "#0d0f20";
  rr(ctx, pad, posterTop, posterW, posterH, 28);
  ctx.fill();
  ctx.restore();
  if (posterImg) {
    ctx.save();
    rr(ctx, pad, posterTop, posterW, posterH, 28);
    ctx.clip();
    const scale = Math.max(posterW / posterImg.naturalWidth, posterH / posterImg.naturalHeight);
    const dw = posterImg.naturalWidth * scale, dh = posterImg.naturalHeight * scale;
    ctx.drawImage(posterImg, pad + (posterW - dw) / 2, posterTop + (posterH - dh) / 2, dw, dh);
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  rr(ctx, pad, posterTop, posterW, posterH, 28);
  ctx.stroke();
  y = posterTop + posterH + posterGapAfter;

  // Type + year badges, centered
  const typeStyle = TYPE_STYLE[mediaType] ?? TYPE_STYLE.movie;
  const badges = [[typeStyle.label, typeStyle, 20]];
  if (detailLevel !== "minimal" && year) badges.push([String(year), { bg: "#12163a", border: "#2a3570", text: "#8b8bff" }, 20]);
  drawBadgeRow(ctx, badges, width / 2, y + 20, 12);
  y += badgeRowH;

  // Title — up to 2 lines, ellipsized rather than hard-cut.
  ctx.font = "800 56px Inter,sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  titleLines.forEach((line, i) => ctx.fillText(line, width / 2, y + i * titleLH));
  y += titleLines.length * titleLH + 24;

  // Genres (rich only) — pills, not a plain dot-separated string.
  if (genreRowH > 0) {
    const genreBadges = genres.slice(0, 3).map((g) => [g, { bg: "rgba(255,255,255,0.04)", border: "#2a3570", text: "#8383e7" }, 16]);
    drawBadgeRow(ctx, genreBadges, width / 2, y + 16, 10);
    y += genreRowH;
  }

  // Divider before the rating block
  ctx.strokeStyle = "#1a1f3a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += dividerGapH;

  // Rating
  if (userRating != null) {
    ctx.font = "700 22px Inter,sans-serif";
    ctx.fillStyle = "#7070a8";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`@${username}'s rating`, width / 2, y);
    y += 40;
    drawHearts(ctx, userRating, (width - 5 * (26 + 9)) / 2, y, 26, 9);
    y += 34;
    ctx.font = "800 30px Inter,sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${userRating}/10`, width / 2, y);
  } else {
    ctx.font = "italic 500 22px Inter,sans-serif";
    ctx.fillStyle = "#4a4a7a";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Not yet rated", width / 2, y);
  }

  drawFooter(ctx, width, height, pad, 22);
}

export async function generateMediaShareCard(format, detailLevel, mediaData, scale = 1, caption = "") {
  const formatDims = FORMATS[format];
  const canvas = new OffscreenCanvas(formatDims.width * scale, formatDims.height * scale);
  const ctx = canvas.getContext("2d");
  await document.fonts.ready;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(scale, scale);

  const posterImg = mediaData.posterPath ? await loadImg(`https://image.tmdb.org/t/p/w500${mediaData.posterPath}`) : null;
  const bannerImg = await loadImg("/assets/banner.png").catch(() => null);

  const data = {
    width: formatDims.width,
    height: formatDims.height,
    title: mediaData.title,
    posterImg,
    userRating: mediaData.userRating || null,
    year: mediaData.releaseYear,
    mediaType: mediaData.mediaType ?? (mediaData.type === "show" ? "show" : "movie"),
    genres: mediaData.genres || [],
    overview: mediaData.overview,
    detailLevel,
    username: mediaData.username || "user",
    logoImg: bannerImg,
    caption,
  };

  layoutStory(ctx, data);
  return canvas.convertToBlob({ type: "image/png" });
}
