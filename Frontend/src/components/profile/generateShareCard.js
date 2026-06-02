// Canvas-based share card generator.
// Two formats: story (9:16) and wide (16:9).
// scale=1 for preview, scale=3 for 4K download.

export const FORMATS = {
  story:  { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  wide:   { width: 1080, height: 608  },
};

const TIER_LABELS = { free: "Free", premium: "Premium", pro: "Pro", pro_plus: "Pro+", god: "God" };
const TIER_COLORS = {
  free:     { bg: "#0a1a0a", border: "#1a4a1a", text: "#4ade80" },
  premium:  { bg: "#1a1200", border: "#4a3800", text: "#fbbf24" },
  pro:      { bg: "#001a2a", border: "#00406a", text: "#38bdf8" },
  pro_plus: { bg: "#160028", border: "#3a0070", text: "#c084fc" },
  god:      { bg: "#2a0010", border: "#700028", text: "#fb7185" },
};
const PERSONALITY_MAP = {
  "Drama":"Drama Devotee","Thriller":"Thriller Junkie","Comedy":"Comedy Lover",
  "Action":"Action Fanatic","Science Fiction":"Sci-Fi Nerd","Horror":"Horror Buff",
  "Romance":"Hopeless Romantic","Animation":"Animation Fan","Crime":"Crime Addict",
  "Documentary":"Doc Watcher","Fantasy":"Fantasy Explorer","Adventure":"Adventure Seeker",
  "Mystery":"Mystery Hunter","History":"History Buff","War":"War Film Fan",
  "Western":"Western Rider","Music":"Music Fanatic","Family":"Family Viewer",
};
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function getTierLevel(tier) {
  if (["pro","pro_plus","god"].includes(tier)) return "pro";
  if (tier === "premium") return "premium";
  return "free";
}

function loadImg(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ─── drawing primitives ───────────────────────────────────────────────────────
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

function drawAvatar(ctx, cx, cy, r, initials, fontSize) {
  ctx.fillStyle = "#1a1d35"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = "#3a3a7a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r-1, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = "#a0a0e8";
  ctx.font = `700 ${fontSize}px 'Inter','Helvetica Neue',Arial,sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(initials, cx, cy + fontSize*0.06);
}

function drawBadge(ctx, text, x, midY, style, fontSize) {
  ctx.font = `700 ${fontSize}px 'Inter','Helvetica Neue',Arial,sans-serif`;
  const tw = ctx.measureText(text).width;
  const hp = fontSize*0.75, vp = fontSize*0.42;
  const bw = tw+hp*2, bh = fontSize+vp*2, by = midY-bh/2;
  ctx.fillStyle = style.bg; rr(ctx, x, by, bw, bh, bh/2); ctx.fill();
  ctx.strokeStyle = style.border; ctx.lineWidth = 1; rr(ctx, x, by, bw, bh, bh/2); ctx.stroke();
  ctx.fillStyle = style.text; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x+bw/2, midY+fontSize*0.04);
  return bw;
}

function drawStatBox(ctx, val, label, x, y, w, h, r, valFs, labelFs) {
  ctx.fillStyle = "rgba(255,255,255,0.035)"; rr(ctx, x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = "#1a1f3a"; ctx.lineWidth = 1; rr(ctx, x, y, w, h, r); ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${valFs}px 'Inter','Helvetica Neue',Arial,sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(val ?? 0), x+w/2, y+h*0.41);
  ctx.fillStyle = "#4a4a7a";
  ctx.font = `600 ${labelFs}px 'Inter','Helvetica Neue',Arial,sans-serif`;
  ctx.fillText(label.toUpperCase(), x+w/2, y+h*0.73);
}

function drawPosters(ctx, posterImgs, n, x, y, totalW, posterGap, r) {
  n = Math.max(n, 1);
  const sw = (totalW - posterGap*(n-1)) / n;
  const h = Math.round(sw * 1.5);
  for (let i = 0; i < n; i++) {
    const sx = x + i*(sw+posterGap);
    ctx.fillStyle = "#0d0f20"; rr(ctx, sx, y, sw, h, r); ctx.fill();
    ctx.strokeStyle = "#1a1f3a"; ctx.lineWidth = 1; rr(ctx, sx, y, sw, h, r); ctx.stroke();
    const img = posterImgs[i];
    if (img) {
      ctx.save(); rr(ctx, sx, y, sw, h, r); ctx.clip();
      const s = Math.min(sw/img.naturalWidth, h/img.naturalHeight);
      ctx.drawImage(img, sx+(sw-img.naturalWidth*s)/2, y+(h-img.naturalHeight*s)/2, img.naturalWidth*s, img.naturalHeight*s);
      ctx.restore();
    }
  }
  return h;
}

function drawHistogram(ctx, histogram, total, avg, x, y, totalW, h, avgFs) {
  const vals = [1,2,3,4,5,6,7,8,9,10];
  const counts = vals.map(v => histogram[v] ?? 0);
  const maxC = Math.max(...counts, 1);
  const bg = 5, bw = (totalW - bg*9) / 10;
  vals.forEach((v, i) => {
    const cnt = counts[i];
    const bh = cnt > 0 ? (cnt/maxC)*h : h*0.02;
    ctx.fillStyle = cnt===maxC && cnt>0 ? "#6050c0" : "#2a2560";
    ctx.beginPath(); ctx.roundRect(x+i*(bw+bg), y+h-bh, bw, bh, 4); ctx.fill();
  });
  const txt = avg!=null ? `avg ${avg}/10 · ${total} rating${total!==1?"s":""}` : `${total} rating${total!==1?"s":""}`;
  ctx.fillStyle = "#505080";
  ctx.font = `${avgFs}px 'Inter','Helvetica Neue',Arial,sans-serif`;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(txt, x, y+h+avgFs+8);
  return h + avgFs + 8;
}

function drawGenreBars(ctx, genreStats, topN, x, y, totalW, { rowH=30, labelFs=16, valueFs=13, barH=8, labelW=140, valueW=36 }) {
  if (!genreStats?.length) return 0;
  const items = genreStats.slice(0, topN);
  const maxC = items[0]?.rating_count ?? 1;
  const barX = x + labelW + 6;
  const barTotalW = totalW - labelW - valueW - 14;
  items.forEach((g, i) => {
    const iy = y + i*rowH;
    const fill = Math.max(barTotalW*(g.rating_count/maxC), 4);
    let name = g.genre_name;
    ctx.font = `500 ${labelFs}px 'Inter','Helvetica Neue',Arial,sans-serif`;
    while (name.length > 1 && ctx.measureText(name).width > labelW-6) name = name.slice(0,-1);
    ctx.fillStyle = "#8080b8"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(name, x, iy+rowH/2);
    ctx.fillStyle = "#1a1f3a"; ctx.beginPath();
    ctx.roundRect(barX, iy+(rowH-barH)/2, barTotalW, barH, barH/2); ctx.fill();
    ctx.fillStyle = "#5040a0"; ctx.beginPath();
    ctx.roundRect(barX, iy+(rowH-barH)/2, fill, barH, barH/2); ctx.fill();
    ctx.fillStyle = "#5a5a8a";
    ctx.font = `600 ${valueFs}px 'Inter','Helvetica Neue',Arial,sans-serif`;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(g.rating_count, x+totalW, iy+rowH/2);
  });
  return items.length * rowH;
}

function drawDecadeBars(ctx, decadeStats, x, y, totalW, { barH=52, barGap=12, labelFs=14 }) {
  if (!decadeStats?.length) return 0;
  const n = decadeStats.length;
  const maxC = Math.max(...decadeStats.map(d=>d.count), 1);
  const bw = (totalW - barGap*(n-1)) / n;
  decadeStats.forEach((d, i) => {
    const bx = x + i*(bw+barGap);
    const bh = Math.max((d.count/maxC)*barH, 4);
    ctx.fillStyle = d.count===maxC ? "#6050c0" : "#2a2560";
    ctx.beginPath(); ctx.roundRect(bx, y+barH-bh, bw, bh, 4); ctx.fill();
    ctx.fillStyle = "#3a3a6a";
    ctx.font = `${labelFs}px 'Inter','Helvetica Neue',Arial,sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(`${d.decade}s`, bx+bw/2, y+barH+labelFs+5);
  });
  return barH + labelFs + 5 + 6;
}

// Personality section — emoji left, stacked "YOUR VIBE" label + value right
function drawPersonality(ctx, personality, x, y, totalW, { persIcon, persLabel, pers }) {
  if (!personality) return 0;
  ctx.strokeStyle = "#1a1f3a"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+totalW, y); ctx.stroke();
  const divPad = pers > 28 ? 26 : 16;
  y += divPad;
  const innerGap = Math.round(persLabel * 0.35);
  const textBlockH = persLabel + innerGap + pers;
  const iconCy = y + textBlockH / 2;
  ctx.font = `${persIcon}px sans-serif`;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText("🎭", x, iconCy);
  const textX = x + persIcon + (pers > 28 ? 18 : 12);
  ctx.font = `700 ${persLabel}px 'Inter','Helvetica Neue',Arial,sans-serif`;
  ctx.fillStyle = "#4a4a7a"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText("YOUR VIBE", textX, y + persLabel/2);
  ctx.font = `800 ${pers}px 'Inter','Helvetica Neue',Arial,sans-serif`;
  ctx.fillStyle = "#a090ff"; ctx.textBaseline = "middle";
  ctx.fillText(personality, textX, y + persLabel + innerGap + pers/2);
  return divPad + textBlockH;
}

function drawFooterCentered(ctx, width, height, pad, footerFs) {
  const text = "watchpapa.tv";
  ctx.font = `600 ${footerFs}px 'Inter','Helvetica Neue',Arial,sans-serif`;
  ctx.fillStyle = "#2a2f5a";
  const fy = height - pad + footerFs*0.2;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, width/2, fy);
  const tw = ctx.measureText(text).width;
  const dr = footerFs > 14 ? 3 : 2;
  [width/2-tw/2-14, width/2+tw/2+14].forEach(cx => {
    ctx.beginPath(); ctx.arc(cx, fy, dr, 0, Math.PI*2); ctx.fill();
  });
}

// ─── STORY layout (9:16) ──────────────────────────────────────────────────────
function layoutStory(ctx, d) {
  const { width, height, profile, tierStyle, tierLabel, favList, posterImgs, basic, genreStats, decadeStats, logoImg, dateLabel, personality } = d;
  const tierLevel = d.tierLevel;
  const pad = 80, gap = 64, innerW = width - pad*2;

  const fs = {
    logoH: 50, date: 24,
    avR: 55, avatarGap: 28, username: 50, badge: 21, bio: 24,
    posterGap: 18, posterR: 20,
    statH: 144, statGap: 18, statR: 20, statVal: 60, statLabel: 18,
    histH: 100, histAvg: 20,
    genreRow: 34, genreLabel: 20, genreVal: 18, genreLabelW: 175,
    decadeH: 70, decadeLabel: 18,
    persIcon: 48, persLabel: 20, pers: 42,
    footer: 22,
  };

  let y = pad;

  // Header — logo centered at top
  const logoW = fs.logoH*(logoImg?.naturalWidth/logoImg?.naturalHeight || 1);
  if (logoImg) ctx.drawImage(logoImg, (width-logoW)/2, y, logoW, fs.logoH);
  else { ctx.font=`800 36px 'Inter',sans-serif`; ctx.fillStyle="#8080c0"; ctx.textAlign="center"; ctx.textBaseline="top"; ctx.fillText("watchpapa", width/2, y+fs.logoH*0.1); }
  ctx.font=`600 ${fs.date}px 'Inter','Helvetica Neue',Arial,sans-serif`; ctx.fillStyle="#3a3a6a"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(dateLabel, width/2, y+fs.logoH*1.4);
  y += fs.logoH + gap*1.5;

  // User
  drawAvatar(ctx, pad+fs.avR, y+fs.avR, fs.avR, (profile?.username?.[0]??"?").toUpperCase(), Math.round(fs.avR*0.82));
  const userX = pad+fs.avR*2+fs.avatarGap;
  const hasBio = !!profile?.bio;
  const unameY = y + fs.avR*(hasBio ? 0.52 : 1);
  let dname = `@${profile?.username??""}`;
  ctx.font=`800 ${fs.username}px 'Inter','Helvetica Neue',Arial,sans-serif`; ctx.fillStyle="#fff"; ctx.textAlign="left"; ctx.textBaseline="middle";
  const maxNW = innerW - fs.avR*2 - fs.avatarGap - 200;
  while (ctx.measureText(dname).width > maxNW && dname.length > 2) dname = dname.slice(0,-1);
  ctx.fillText(dname, userX, unameY);
  drawBadge(ctx, tierLabel, userX+ctx.measureText(dname).width+14, unameY, tierStyle, fs.badge);
  if (hasBio) {
    ctx.font=`${fs.bio}px 'Inter','Helvetica Neue',Arial,sans-serif`; ctx.fillStyle="#7070a8"; ctx.textAlign="left"; ctx.textBaseline="middle";
    let bio = profile.bio;
    while (ctx.measureText(bio).width > innerW-fs.avR*2-fs.avatarGap && bio.length>3) bio=bio.slice(0,-1);
    if (bio!==profile.bio) bio=bio.slice(0,-3)+"…";
    ctx.fillText(bio, userX, y+fs.avR*1.62);
  }
  y += fs.avR*2 + gap;

  // Posters
  const posterH = drawPosters(ctx, posterImgs, favList.length, pad, y, innerW, fs.posterGap, fs.posterR);
  y += posterH + gap;

  // Stats (4-in-a-row)
  const stats = [[basic.total,"Rated"],[basic.avg!=null?`${basic.avg}/10`:"—","Avg"],[basic.movieCount,"Movies"],[basic.showCount,"Shows"]];
  const bw = (innerW - fs.statGap*3) / 4;
  stats.forEach(([v,l], i) => drawStatBox(ctx, v, l, pad+i*(bw+fs.statGap), y, bw, fs.statH, fs.statR, fs.statVal, fs.statLabel));
  y += fs.statH + gap;

  // Histogram
  if (basic.total > 0) {
    y += drawHistogram(ctx, basic.histogram, basic.total, basic.avg, pad, y, innerW, fs.histH, fs.histAvg) + gap;
  }

  // Genre bars (premium+)
  if (tierLevel !== "free" && genreStats?.length) {
    y += drawGenreBars(ctx, genreStats, 5, pad, y, innerW, { rowH:fs.genreRow, labelFs:fs.genreLabel, valueFs:fs.genreVal, barH:9, labelW:fs.genreLabelW, valueW:40 }) + gap;
  }

  // Decade bars (pro+)
  if (tierLevel === "pro" && decadeStats?.length) {
    y += drawDecadeBars(ctx, decadeStats, pad, y, innerW, { barH:fs.decadeH, barGap:16, labelFs:fs.decadeLabel }) + gap;
  }

  // Personality
  if (personality) drawPersonality(ctx, personality, pad, y, innerW, { persIcon:fs.persIcon, persLabel:fs.persLabel, pers:fs.pers });

  drawFooterCentered(ctx, width, height, pad, fs.footer);
}

// ─── WIDE layout (16:9) — poster strip top, compact info bar below ─────────────
function layoutWide(ctx, d) {
  const { width, height, profile, tierStyle, tierLabel, favList, posterImgs, basic, genreStats, logoImg, dateLabel, personality } = d;
  const tierLevel = d.tierLevel;
  const padV = 28, padH = 34, innerW = width - padH*2;

  const fs = {
    logoH: 20, date: 11,
    posterGap: 10, posterR: 10,
    avR: 20, avatarGap: 10, username: 17, badge: 9,
    statH: 56, statGap: 10, statR: 10, statVal: 24, statLabel: 8,
    genreRow: 19, genreLabel: 10, genreVal: 9, genreLabelW: 95,
    persLabel: 9, pers: 16,
    footer: 10,
  };

  let y = padV;

  // Header: logo centered, date below
  const logoW = fs.logoH*(logoImg?.naturalWidth/logoImg?.naturalHeight || 1);
  if (logoImg) ctx.drawImage(logoImg, (width-logoW)/2, y, logoW, fs.logoH);
  ctx.font=`600 ${fs.date}px 'Inter','Helvetica Neue',Arial,sans-serif`; ctx.fillStyle="#3a3a6a"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(dateLabel, width/2, y+fs.logoH*1.2);
  y += fs.logoH + 10;

  // Poster row — fills most of the vertical space
  const posterH = drawPosters(ctx, posterImgs, favList.length, padH, y, innerW, fs.posterGap, fs.posterR);
  y += posterH + 14;

  // ── Info bar (everything below the posters) ───────────────────────────────
  const infoAvail = height - padV - y; // remaining px above bottom padding

  // Row 1: avatar + username + tier  |  personality (right-aligned)
  const avCy = y + fs.avR;
  drawAvatar(ctx, padH+fs.avR, avCy, fs.avR, (profile?.username?.[0]??"?").toUpperCase(), Math.round(fs.avR*0.82));
  const userX = padH + fs.avR*2 + fs.avatarGap;
  ctx.font=`700 ${fs.username}px 'Inter','Helvetica Neue',Arial,sans-serif`; ctx.fillStyle="#fff"; ctx.textAlign="left"; ctx.textBaseline="middle";
  let dname = `@${profile?.username??""}`;
  while (ctx.measureText(dname).width > innerW*0.35 && dname.length>2) dname=dname.slice(0,-1);
  ctx.fillText(dname, userX, avCy);
  drawBadge(ctx, tierLabel, userX+ctx.measureText(dname).width+8, avCy, tierStyle, fs.badge);

  if (personality) {
    // Right-aligned "YOUR VIBE / Action Fanatic"
    const innerGap = 3;
    const blockH = fs.persLabel + innerGap + fs.pers;
    const pBaseY = y + (fs.avR*2 - blockH) / 2;
    ctx.font=`700 ${fs.persLabel}px 'Inter','Helvetica Neue',Arial,sans-serif`; ctx.fillStyle="#4a4a7a"; ctx.textAlign="right"; ctx.textBaseline="middle";
    ctx.fillText("YOUR VIBE", width-padH, pBaseY+fs.persLabel/2);
    ctx.font=`800 ${fs.pers}px 'Inter','Helvetica Neue',Arial,sans-serif`; ctx.fillStyle="#a090ff"; ctx.textBaseline="middle";
    ctx.fillText(personality, width-padH, pBaseY+fs.persLabel+innerGap+fs.pers/2);
  }

  y += fs.avR*2 + 10;

  // Row 2: 4 stat boxes full width
  const bw = (innerW - fs.statGap*3) / 4;
  [[basic.total,"Rated"],[basic.avg!=null?`${basic.avg}/10`:"—","Avg"],[basic.movieCount,"Movies"],[basic.showCount,"Shows"]]
    .forEach(([v,l], i) => drawStatBox(ctx, v, l, padH+i*(bw+fs.statGap), y, bw, fs.statH, fs.statR, fs.statVal, fs.statLabel));
  y += fs.statH + 10;

  // Row 3: genre bars (premium) or histogram — fill remaining space
  const remaining = height - padV - y;
  if (remaining >= fs.genreRow && tierLevel !== "free" && genreStats?.length) {
    const topN = Math.min(genreStats.length, Math.floor(remaining / fs.genreRow));
    drawGenreBars(ctx, genreStats, topN, padH, y, innerW, {
      rowH: fs.genreRow, labelFs: fs.genreLabel, valueFs: fs.genreVal, barH: 6, labelW: fs.genreLabelW, valueW: 28,
    });
  }

  // Footer bottom-right
  ctx.font=`600 ${fs.footer}px 'Inter','Helvetica Neue',Arial,sans-serif`; ctx.fillStyle="#2a2f5a"; ctx.textAlign="right"; ctx.textBaseline="middle";
  ctx.fillText("· watchpapa.tv ·", width-padH, height-padV+fs.footer*0.2);
}

// ─── SQUARE layout (1:1) — 2×2 stat grid, Instagram post style ───────────────
function layoutSquare(ctx, d) {
  const { width, height, profile, tierStyle, tierLabel, favList, posterImgs, basic, genreStats, logoImg, dateLabel, personality } = d;
  const tierLevel = d.tierLevel;
  const pad = 54, gap = 28, innerW = width - pad*2;

  const fs = {
    logoH: 33, date: 16, avR: 38, avatarGap: 18, username: 33, badge: 13,
    posterGap: 12, posterR: 12,
    statH: 90, statGap: 11, statR: 13, statVal: 38, statLabel: 11,
    histH: 62, histAvg: 13,
    genreRow: 24, genreLabel: 13, genreVal: 11, genreLabelW: 140,
    persIcon: 32, persLabel: 13, pers: 26,
    footer: 15,
  };

  let y = pad;

  // Header — logo centered at top
  const logoW = fs.logoH*(logoImg?.naturalWidth/logoImg?.naturalHeight || 1);
  if (logoImg) ctx.drawImage(logoImg, (width-logoW)/2, y, logoW, fs.logoH);
  else { ctx.font=`800 24px 'Inter',sans-serif`; ctx.fillStyle="#8080c0"; ctx.textAlign="center"; ctx.textBaseline="top"; ctx.fillText("watchpapa", width/2, y+fs.logoH*0.1); }
  ctx.font=`600 ${fs.date}px 'Inter','Helvetica Neue',Arial,sans-serif`; ctx.fillStyle="#3a3a6a"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(dateLabel, width/2, y+fs.logoH*1.3);
  y += fs.logoH + gap*1.2;

  // User (no bio — space is tight)
  drawAvatar(ctx, pad+fs.avR, y+fs.avR, fs.avR, (profile?.username?.[0]??"?").toUpperCase(), Math.round(fs.avR*0.82));
  const userX = pad+fs.avR*2+fs.avatarGap;
  ctx.font=`800 ${fs.username}px 'Inter','Helvetica Neue',Arial,sans-serif`; ctx.fillStyle="#fff"; ctx.textAlign="left"; ctx.textBaseline="middle";
  let dname = `@${profile?.username??""}`;
  while (ctx.measureText(dname).width > innerW-fs.avR*2-fs.avatarGap-160 && dname.length>2) dname=dname.slice(0,-1);
  ctx.fillText(dname, userX, y+fs.avR);
  drawBadge(ctx, tierLabel, userX+ctx.measureText(dname).width+12, y+fs.avR, tierStyle, fs.badge);
  y += fs.avR*2 + gap;

  // Posters
  const posterH = drawPosters(ctx, posterImgs, favList.length, pad, y, innerW, fs.posterGap, fs.posterR);
  y += posterH + gap;

  // Stats — 2×2 grid (distinct from story's 4-in-a-row)
  const bw = (innerW - fs.statGap) / 2;
  [[basic.total,"Rated"],[basic.avg!=null?`${basic.avg}/10`:"—","Avg"],[basic.movieCount,"Movies"],[basic.showCount,"Shows"]].forEach(([v,l], i) => {
    drawStatBox(ctx, v, l, pad+(i%2)*(bw+fs.statGap), y+Math.floor(i/2)*(fs.statH+fs.statGap), bw, fs.statH, fs.statR, fs.statVal, fs.statLabel);
  });
  y += fs.statH*2 + fs.statGap + gap;

  // Histogram
  if (basic.total > 0) {
    y += drawHistogram(ctx, basic.histogram, basic.total, basic.avg, pad, y, innerW, fs.histH, fs.histAvg) + gap;
  }

  // Genre bars (premium, top 3 only — space constraint)
  if (tierLevel !== "free" && genreStats?.length) {
    y += drawGenreBars(ctx, genreStats, 3, pad, y, innerW, { rowH:fs.genreRow, labelFs:fs.genreLabel, valueFs:fs.genreVal, barH:7, labelW:fs.genreLabelW, valueW:34 }) + gap;
  }

  // Personality
  if (personality) drawPersonality(ctx, personality, pad, y, innerW, { persIcon:fs.persIcon, persLabel:fs.persLabel, pers:fs.pers });

  drawFooterCentered(ctx, width, height, pad, fs.footer);
}

// ─── main export ──────────────────────────────────────────────────────────────
export async function generateShareCard({ format, profile, tier, favourites, basic, genreStats, decadeStats, scale = 3 }) {
  const { width, height } = FORMATS[format] ?? FORMATS.story;
  await document.fonts.ready;

  const now = new Date();
  const tierStyle = TIER_COLORS[tier] ?? TIER_COLORS.free;
  const tierLabel = TIER_LABELS[tier] ?? tier;
  const tierLevel = getTierLevel(tier);
  const personality = genreStats?.length ? (PERSONALITY_MAP[genreStats[0].genre_name] ?? "Film Fanatic") : null;
  const favList = favourites ?? [];
  const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

  const [logoImg, ...posterImgs] = await Promise.all([
    loadImg("/assets/banner.png"),
    ...favList.map(fav => {
      const item = fav.movie_id != null ? fav.movie : fav.show;
      const p = item?.poster_path;
      return p ? loadImg(`${API_BASE}/api/image-proxy?path=${encodeURIComponent(p)}&size=w342`) : Promise.resolve(null);
    }),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = width * scale; canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.scale(scale, scale);

  drawBg(ctx, width, height);

  const d = {
    width, height, profile, tier, tierStyle, tierLabel, tierLevel, favList, posterImgs,
    basic: basic ?? { total:0, avg:null, histogram:{}, movieCount:0, showCount:0 },
    genreStats, decadeStats,
    logoImg,
    dateLabel: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    personality,
  };

  if (format === "wide") layoutWide(ctx, d);
  else if (format === "square") layoutSquare(ctx, d);
  else layoutStory(ctx, d);

  return canvas;
}

export async function generateRecapShareCard(format, recapData, profileData, scale = 1) {
  const { profile, tier } = profileData;
  const { count, avg, movieCount, showCount } = recapData;
  const { width, height } = FORMATS[format];

  const canvas = document.createElement("canvas");
  canvas.width = width * scale; canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.scale(scale, scale);

  drawBg(ctx, width, height);

  const tierStyle = TIER_COLORS[getTierLevel(tier)];
  const tierLabel = TIER_LABELS[tier];
  const now = new Date();
  const logoImg = await loadImg("https://watchpapa.tv/logo_v3.1.svg").catch(() => null);

  if (format === "story") {
    const pad = 60, gap = 48;
    let y = pad;
    const logoH = 50;
    const logoW = logoH * (logoImg?.naturalWidth / logoImg?.naturalHeight || 1);
    if (logoImg) ctx.drawImage(logoImg, (width - logoW)/2, y, logoW, logoH);
    else { ctx.font = "800 32px Inter,sans-serif"; ctx.fillStyle = "#8080c0"; ctx.textAlign = "center"; ctx.fillText("watchpapa", width/2, y + logoH*0.15); }
    y += logoH + gap;
    ctx.font = "700 32px Inter,sans-serif"; ctx.fillStyle = "#d0a0ff"; ctx.textAlign = "center";
    ctx.fillText("WEEKLY RECAP", width/2, y);
    y += 48;
    const dateStr = `${MONTHS[Math.max(0, now.getMonth()-1)]} ${now.getDate()} – ${MONTHS[now.getMonth()]} ${now.getDate()}`;
    ctx.font = "500 14px Inter,sans-serif"; ctx.fillStyle = "#6868b8"; ctx.fillText(dateStr, width/2, y);
    y += gap;
    ctx.font = "800 72px Inter,sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(count.toString(), width/2, y + 40);
    y += 90;
    ctx.font = "500 14px Inter,sans-serif"; ctx.fillStyle = "#9090c8"; ctx.fillText("ratings", width/2, y);
    y += gap + 8;
    if (avg) {
      ctx.font = "600 14px Inter,sans-serif"; ctx.fillStyle = "#c084fc"; ctx.fillText("Average rating", width/2, y); y += 24;
      const heartSize = 18, heartSpacing = 6;
      const hearts = Math.round(avg);
      const heartStartX = (width - 5*(heartSize + heartSpacing))/2;
      for (let i = 1; i <= 5; i++) {
        const fill = hearts >= i*2 ? "full" : hearts >= i*2-1 ? "half" : "empty";
        const sx = heartStartX + (i-1)*(heartSize + heartSpacing);
        ctx.save();
        ctx.translate(sx, y);
        ctx.scale(heartSize/16, heartSize/16);
        const heartPath = "M8 14.7C3.8 11.2 1 8.8 1 6.1 1 4 2.7 2.4 4.8 2.4c1.1 0 2.2.5 3.2 1.8C9 2.9 10.1 2.4 11.2 2.4 13.3 2.4 15 4 15 6.1c0 2.7-2.8 5.1-7 8.6z";
        if (fill === "empty") { ctx.strokeStyle = "#4a4a8a"; ctx.lineWidth = 1.2; ctx.stroke(new Path2D(heartPath)); }
        else if (fill === "full") { ctx.fillStyle = "#a090ff"; ctx.fill(new Path2D(heartPath)); }
        else { ctx.fillStyle = "#a090ff"; ctx.fill(new Path2D(heartPath)); ctx.globalCompositeOperation = "destination-out"; ctx.fillRect(8, 0, 8, 16); ctx.globalCompositeOperation = "source-over"; }
        ctx.restore();
      }
      y += 28;
      ctx.font = "600 16px Inter,sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText((avg/2).toFixed(1), width/2, y + 4);
      y += gap;
    }
    y += 16;
    const statBoxY = y, statBoxH = 60;
    const statBoxW = (width - pad*2 - 16) / 2;
    ctx.fillStyle = "#0a0c18"; rr(ctx, pad, statBoxY, statBoxW, statBoxH, 12); ctx.fill();
    ctx.fillStyle = "#12163a"; rr(ctx, pad + statBoxW + 16, statBoxY, statBoxW, statBoxH, 12); ctx.fill();
    ctx.font = "700 24px Inter,sans-serif"; ctx.fillStyle = "#a090ff"; ctx.textAlign = "center";
    ctx.fillText(movieCount.toString(), pad + statBoxW/2, statBoxY + 18);
    ctx.font = "500 12px Inter,sans-serif"; ctx.fillStyle = "#6868b8"; ctx.fillText("Movies", pad + statBoxW/2, statBoxY + 42);
    ctx.fillStyle = "#a090ff"; ctx.fillText(showCount.toString(), pad + statBoxW + 16 + statBoxW/2, statBoxY + 18);
    ctx.fillStyle = "#6868b8"; ctx.fillText("Shows", pad + statBoxW + 16 + statBoxW/2, statBoxY + 42);
    y = height - pad - 32;
    ctx.font = "700 16px Inter,sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(`@${profile.username}`, width/2, y);
    y += 28;
    const tierColor = tierStyle.text;
    rr(ctx, (width - 140)/2, y, 140, 24, 8);
    ctx.fillStyle = tierStyle.bg; ctx.fill();
    ctx.strokeStyle = tierStyle.border; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = "700 12px Inter,sans-serif"; ctx.fillStyle = tierColor; ctx.textAlign = "center"; ctx.fillText(tierLabel, width/2, y + 16);
    y += 36;
    ctx.font = "500 11px Inter,sans-serif"; ctx.fillStyle = "#2a2f5a"; ctx.textAlign = "center"; ctx.fillText("watchpapa.tv", width/2, height - 20);
  } else if (format === "square") {
    const pad = 48, gap = 32;
    let y = pad;
    const logoH = 36;
    const logoW = logoH * (logoImg?.naturalWidth / logoImg?.naturalHeight || 1);
    if (logoImg) ctx.drawImage(logoImg, (width - logoW)/2, y, logoW, logoH);
    else { ctx.font = "800 24px Inter,sans-serif"; ctx.fillStyle = "#8080c0"; ctx.textAlign = "center"; ctx.fillText("watchpapa", width/2, y + logoH*0.15); }
    y += logoH + gap;
    ctx.font = "700 24px Inter,sans-serif"; ctx.fillStyle = "#d0a0ff"; ctx.textAlign = "center";
    ctx.fillText("WEEKLY RECAP", width/2, y);
    y += 40;
    ctx.font = "800 48px Inter,sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(count.toString(), width/2, y + 28);
    y += 68;
    ctx.font = "500 12px Inter,sans-serif"; ctx.fillStyle = "#6868b8"; ctx.fillText("ratings", width/2, y);
    y += gap;
    if (avg) {
      ctx.font = "600 12px Inter,sans-serif"; ctx.fillStyle = "#c084fc"; ctx.fillText("Avg rating", width/2, y); y += 18;
      const heartSize = 14, heartSpacing = 5;
      const hearts = Math.round(avg);
      const heartStartX = (width - 5*(heartSize + heartSpacing))/2;
      for (let i = 1; i <= 5; i++) {
        const fill = hearts >= i*2 ? "full" : hearts >= i*2-1 ? "half" : "empty";
        const sx = heartStartX + (i-1)*(heartSize + heartSpacing);
        ctx.save();
        ctx.translate(sx, y);
        ctx.scale(heartSize/16, heartSize/16);
        const heartPath = "M8 14.7C3.8 11.2 1 8.8 1 6.1 1 4 2.7 2.4 4.8 2.4c1.1 0 2.2.5 3.2 1.8C9 2.9 10.1 2.4 11.2 2.4 13.3 2.4 15 4 15 6.1c0 2.7-2.8 5.1-7 8.6z";
        if (fill === "empty") { ctx.strokeStyle = "#4a4a8a"; ctx.lineWidth = 1.2; ctx.stroke(new Path2D(heartPath)); }
        else if (fill === "full") { ctx.fillStyle = "#a090ff"; ctx.fill(new Path2D(heartPath)); }
        else { ctx.fillStyle = "#a090ff"; ctx.fill(new Path2D(heartPath)); ctx.globalCompositeOperation = "destination-out"; ctx.fillRect(8, 0, 8, 16); ctx.globalCompositeOperation = "source-over"; }
        ctx.restore();
      }
      y += 20;
      ctx.font = "500 12px Inter,sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText((avg/2).toFixed(1), width/2, y + 2);
      y += gap;
    }
    const statBoxH = 48, statBoxW = (width - pad*2 - 12) / 2;
    ctx.fillStyle = "#0a0c18"; rr(ctx, pad, y, statBoxW, statBoxH, 10); ctx.fill();
    ctx.fillStyle = "#12163a"; rr(ctx, pad + statBoxW + 12, y, statBoxW, statBoxH, 10); ctx.fill();
    ctx.font = "700 18px Inter,sans-serif"; ctx.fillStyle = "#a090ff"; ctx.textAlign = "center";
    ctx.fillText(movieCount.toString(), pad + statBoxW/2, y + 14);
    ctx.font = "500 10px Inter,sans-serif"; ctx.fillStyle = "#6868b8"; ctx.fillText("Movies", pad + statBoxW/2, y + 32);
    ctx.fillStyle = "#a090ff"; ctx.fillText(showCount.toString(), pad + statBoxW + 12 + statBoxW/2, y + 14);
    ctx.fillStyle = "#6868b8"; ctx.fillText("Shows", pad + statBoxW + 12 + statBoxW/2, y + 32);
    y += statBoxH + gap;
    ctx.font = "700 14px Inter,sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(`@${profile.username}`, width/2, y);
    y += 22;
    const tierW = 110;
    rr(ctx, (width - tierW)/2, y, tierW, 20, 6);
    ctx.fillStyle = tierStyle.bg; ctx.fill();
    ctx.strokeStyle = tierStyle.border; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = "700 11px Inter,sans-serif"; ctx.fillStyle = tierStyle.text; ctx.textAlign = "center"; ctx.fillText(tierLabel, width/2, y + 13);
    ctx.font = "500 10px Inter,sans-serif"; ctx.fillStyle = "#2a2f5a"; ctx.textAlign = "center"; ctx.fillText("watchpapa.tv", width/2, height - 16);
  } else {
    const padV = 28, padH = 40;
    let y = padV;
    const logoH = 24;
    const logoW = logoH * (logoImg?.naturalWidth / logoImg?.naturalHeight || 1);
    if (logoImg) ctx.drawImage(logoImg, (width - logoW)/2, y, logoW, logoH);
    else { ctx.font = "800 18px Inter,sans-serif"; ctx.fillStyle = "#8080c0"; ctx.textAlign = "center"; ctx.fillText("watchpapa", width/2, y + logoH*0.15); }
    y += logoH + 20;
    ctx.font = "700 20px Inter,sans-serif"; ctx.fillStyle = "#d0a0ff"; ctx.textAlign = "center"; ctx.fillText("WEEKLY RECAP", width/2, y);
    y += 40;
    ctx.font = "700 32px Inter,sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(`${count} ratings`, width/2, y);
    y += 40;
    if (avg) {
      ctx.font = "600 12px Inter,sans-serif"; ctx.fillStyle = "#c084fc"; ctx.fillText("Average rating", width/2, y); y += 18;
      const heartSize = 16, heartSpacing = 5;
      const hearts = Math.round(avg);
      const heartStartX = (width - 5*(heartSize + heartSpacing))/2;
      for (let i = 1; i <= 5; i++) {
        const fill = hearts >= i*2 ? "full" : hearts >= i*2-1 ? "half" : "empty";
        const sx = heartStartX + (i-1)*(heartSize + heartSpacing);
        ctx.save();
        ctx.translate(sx, y);
        ctx.scale(heartSize/16, heartSize/16);
        const heartPath = "M8 14.7C3.8 11.2 1 8.8 1 6.1 1 4 2.7 2.4 4.8 2.4c1.1 0 2.2.5 3.2 1.8C9 2.9 10.1 2.4 11.2 2.4 13.3 2.4 15 4 15 6.1c0 2.7-2.8 5.1-7 8.6z";
        if (fill === "empty") { ctx.strokeStyle = "#4a4a8a"; ctx.lineWidth = 1.2; ctx.stroke(new Path2D(heartPath)); }
        else if (fill === "full") { ctx.fillStyle = "#a090ff"; ctx.fill(new Path2D(heartPath)); }
        else { ctx.fillStyle = "#a090ff"; ctx.fill(new Path2D(heartPath)); ctx.globalCompositeOperation = "destination-out"; ctx.fillRect(8, 0, 8, 16); ctx.globalCompositeOperation = "source-over"; }
        ctx.restore();
      }
      y += 20;
      ctx.font = "600 12px Inter,sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText((avg/2).toFixed(1), width/2, y);
    }
    y = height - padV - 26;
    ctx.font = "600 12px Inter,sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(`@${profile.username}`, width/2, y);
    y += 20;
    const tierW = 100;
    rr(ctx, (width - tierW)/2, y, tierW, 18, 5);
    ctx.fillStyle = tierStyle.bg; ctx.fill();
    ctx.strokeStyle = tierStyle.border; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.font = "700 10px Inter,sans-serif"; ctx.fillStyle = tierStyle.text; ctx.textAlign = "center"; ctx.fillText(tierLabel, width/2, y + 12);
    ctx.font = "500 9px Inter,sans-serif"; ctx.fillStyle = "#2a2f5a"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("watchpapa.tv", width/2, height - padV + 4);
  }

  return canvas;
}
