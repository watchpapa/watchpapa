export const FORMATS = {
  story:  { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  wide:   { width: 1080, height: 608  },
};

function loadImg(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w/2, h/2));
}

function drawBg(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w*0.55, h);
  g.addColorStop(0, "#0e1028"); g.addColorStop(0.55, "#0a0c18"); g.addColorStop(1, "#080918");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const orb = ctx.createRadialGradient(w*1.05, -h*0.1, 0, w*1.05, -h*0.1, w*0.6);
  orb.addColorStop(0, "rgba(100,80,200,0.16)"); orb.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = orb; ctx.fillRect(0, 0, w, h);
}

function drawHearts(ctx, value, x, y, size, spacing) {
  if (!value) return;
  const heartPath = "M8 14.7C3.8 11.2 1 8.8 1 6.1 1 4 2.7 2.4 4.8 2.4c1.1 0 2.2.5 3.2 1.8C9 2.9 10.1 2.4 11.2 2.4 13.3 2.4 15 4 15 6.1c0 2.7-2.8 5.1-7 8.6z";
  for (let i = 1; i <= 5; i++) {
    const fill = value >= i*2 ? "full" : value >= i*2-1 ? "half" : "empty";
    const sx = x + (i-1)*(size + spacing);
    ctx.save();
    ctx.translate(sx, y);
    ctx.scale(size/16, size/16);
    if (fill === "empty") {
      ctx.strokeStyle = "#4a4a8a"; ctx.lineWidth = 1.2; ctx.stroke(new Path2D(heartPath));
    } else if (fill === "full") {
      ctx.fillStyle = "#a090ff"; ctx.fill(new Path2D(heartPath));
    } else {
      ctx.fillStyle = "#a090ff"; ctx.fill(new Path2D(heartPath));
      ctx.globalCompositeOperation = "destination-out"; ctx.fillRect(8, 0, 8, 16);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
  }
}

function layoutStory(ctx, d) {
  const { width, height, title, posterImg, userRating, year, genres, overview, logoImg, detailLevel } = d;
  const pad = 60, gap = 32;
  drawBg(ctx, width, height);
  let y = pad;
  const logoH = 50;
  const logoW = logoH * (logoImg?.naturalWidth / logoImg?.naturalHeight || 1);
  if (logoImg) ctx.drawImage(logoImg, (width - logoW)/2, y, logoW, logoH);
  else { ctx.font = "800 36px Inter,sans-serif"; ctx.fillStyle = "#8080c0"; ctx.textAlign = "center"; ctx.fillText("watchpapa", width/2, y + logoH*0.1); }
  y += logoH + gap;
  const posterW = width - pad*2, posterH = posterW * 1.5;
  if (posterImg) { ctx.fillStyle = "#0d0f20"; rr(ctx, pad, y, posterW, posterH, 24); ctx.fill(); ctx.save(); rr(ctx, pad, y, posterW, posterH, 24); ctx.clip(); ctx.drawImage(posterImg, pad, y, posterW, posterH); ctx.restore(); }
  y += posterH + gap*0.8;
  ctx.font = "800 48px Inter,sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  let titleText = title;
  while (ctx.measureText(titleText).width > width - pad*2 && titleText.length > 3) titleText = titleText.slice(0, -1);
  ctx.fillText(titleText, width/2, y);
  y += 60;
  if (userRating) {
    ctx.font = "600 16px Inter,sans-serif"; ctx.fillStyle = "#c084fc"; ctx.textAlign = "center"; ctx.fillText("Your rating", width/2, y); y += 28;
    drawHearts(ctx, userRating, (width - 5*(18+6))/2, y, 18, 6);
    y += 32 + gap*0.5;
  }
  if (detailLevel !== "minimal" && year) { ctx.font = "600 18px Inter,sans-serif"; ctx.fillStyle = "#6868b8"; ctx.textAlign = "center"; ctx.fillText(year, width/2, y); y += 32; }
  if (detailLevel === "rich" && genres?.length > 0) { const genreText = genres.slice(0, 3).join(" · "); ctx.font = "500 14px Inter,sans-serif"; ctx.fillStyle = "#4a4a7a"; ctx.textAlign = "center"; ctx.fillText(genreText, width/2, y); y += 28; }
  ctx.font = "600 16px Inter,sans-serif"; ctx.fillStyle = "#2a2f5a"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("watchpapa.tv", width/2, height - pad);
}

function layoutSquare(ctx, d) {
  const { width, height, title, posterImg, userRating, year, genres, logoImg, detailLevel } = d;
  const pad = 48, gap = 24;
  drawBg(ctx, width, height);
  let y = pad;
  const logoH = 36;
  const logoW = logoH * (logoImg?.naturalWidth / logoImg?.naturalHeight || 1);
  if (logoImg) ctx.drawImage(logoImg, (width - logoW)/2, y, logoW, logoH);
  else { ctx.font = "800 28px Inter,sans-serif"; ctx.fillStyle = "#8080c0"; ctx.textAlign = "center"; ctx.fillText("watchpapa", width/2, y + logoH*0.1); }
  y += logoH + gap;
  const posterW = width - pad*2, posterH = posterW * 1.5;
  if (posterImg) { ctx.fillStyle = "#0d0f20"; rr(ctx, pad, y, posterW, posterH, 16); ctx.fill(); ctx.save(); rr(ctx, pad, y, posterW, posterH, 16); ctx.clip(); ctx.drawImage(posterImg, pad, y, posterW, posterH); ctx.restore(); }
  y += posterH + gap;
  ctx.font = "700 28px Inter,sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "center";
  let titleText = title;
  while (ctx.measureText(titleText).width > posterW && titleText.length > 3) titleText = titleText.slice(0, -1);
  ctx.fillText(titleText, width/2, y);
  y += 40;
  if (userRating) { ctx.font = "600 12px Inter,sans-serif"; ctx.fillStyle = "#c084fc"; ctx.fillText("Your rating", width/2, y); y += 20; drawHearts(ctx, userRating, (width - 5*(14+5))/2, y, 14, 5); y += 22 + gap; }
  if (detailLevel !== "minimal") { const infoText = [year, genres?.slice(0, 2).join(" · ")].filter(Boolean).join(" · "); if (infoText) { ctx.font = "500 12px Inter,sans-serif"; ctx.fillStyle = "#6868b8"; ctx.fillText(infoText, width/2, y); y += gap; } }
  ctx.font = "500 12px Inter,sans-serif"; ctx.fillStyle = "#2a2f5a"; ctx.textBaseline = "bottom"; ctx.fillText("watchpapa.tv", width/2, height - pad + 8);
}

function layoutWide(ctx, d) {
  const { width, height, title, posterImg, userRating, year, genres, overview, logoImg, detailLevel } = d;
  const padV = 28, padH = 40;
  drawBg(ctx, width, height);
  let y = padV;
  const logoH = 24;
  const logoW = logoH * (logoImg?.naturalWidth / logoImg?.naturalHeight || 1);
  if (logoImg) ctx.drawImage(logoImg, (width - logoW)/2, y, logoW, logoH);
  else { ctx.font = "800 18px Inter,sans-serif"; ctx.fillStyle = "#8080c0"; ctx.textAlign = "center"; ctx.fillText("watchpapa", width/2, y + logoH*0.1); }
  y += logoH + 16;
  const posterH = height - padV*2 - logoH - 16;
  const posterW = posterH / 1.5;
  if (posterImg) { ctx.fillStyle = "#0d0f20"; rr(ctx, padH, y, posterW, posterH, 12); ctx.fill(); ctx.save(); rr(ctx, padH, y, posterW, posterH, 12); ctx.clip(); ctx.drawImage(posterImg, padH, y, posterW, posterH); ctx.restore(); }
  const infoX = padH + posterW + 24, infoW = width - infoX - padH;
  let infoY = y;
  ctx.font = "700 24px Inter,sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top";
  let titleText = title;
  while (ctx.measureText(titleText).width > infoW && titleText.length > 3) titleText = titleText.slice(0, -1);
  ctx.fillText(titleText, infoX, infoY);
  infoY += 36;
  if (detailLevel !== "minimal" && (year || genres?.length > 0)) { const infoText = [year, genres?.slice(0, 2).join(" · ")].filter(Boolean).join(" · "); ctx.font = "500 12px Inter,sans-serif"; ctx.fillStyle = "#6868b8"; ctx.fillText(infoText, infoX, infoY); infoY += 20; }
  if (userRating) { ctx.font = "500 11px Inter,sans-serif"; ctx.fillStyle = "#c084fc"; ctx.fillText("Your rating", infoX, infoY); infoY += 16; drawHearts(ctx, userRating, infoX, infoY, 12, 4); infoY += 18; }
  ctx.font = "500 10px Inter,sans-serif"; ctx.fillStyle = "#2a2f5a"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("watchpapa.tv", width - padH, height - padV);
}

export async function generateMediaShareCard(format, detailLevel, mediaData, scale = 1) {
  const formatDims = FORMATS[format];
  const canvas = new OffscreenCanvas(formatDims.width * scale, formatDims.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  const posterImg = mediaData.posterPath ? await loadImg(`https://image.tmdb.org/t/p/w342${mediaData.posterPath}`) : null;
  const logoImg = await loadImg("https://watchpapa.tv/logo_v3.1.svg").catch(() => null);

  const data = {
    width: formatDims.width,
    height: formatDims.height,
    title: mediaData.title,
    posterImg,
    userRating: mediaData.userRating || null,
    year: mediaData.releaseYear,
    genres: mediaData.genres || [],
    overview: mediaData.overview,
    logoImg,
    detailLevel,
  };

  if (format === "story") layoutStory(ctx, data);
  else if (format === "square") layoutSquare(ctx, data);
  else if (format === "wide") layoutWide(ctx, data);

  return canvas.convertToBlob({ type: "image/png" });
}
