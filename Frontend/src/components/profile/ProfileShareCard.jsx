// Preview-only component — displayed inside the modal at scaled-down size.
// Not used for image capture; generateShareCard.js handles canvas output.
import { FORMATS } from "./generateShareCard.js";

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

// ─── sub-components ────────────────────────────────────────────────────────────

function StatBox({ val, label, style }) {
  return (
    <div style={{ flex:1, background:"rgba(255,255,255,0.035)", border:"1px solid #1a1f3a", borderRadius: style.r, height: style.h, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap: style.gap }}>
      <span style={{ fontSize: style.val, fontWeight:800, color:"#fff", lineHeight:1, letterSpacing:"-0.02em" }}>{val ?? 0}</span>
      <span style={{ fontSize: style.label, color:"#4a4a7a", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</span>
    </div>
  );
}

function GenreBars({ genreStats, topN, labelW, rowH, labelFs, barH, valueFs }) {
  if (!genreStats?.length) return null;
  const items = genreStats.slice(0, topN);
  const maxC = items[0]?.rating_count ?? 1;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0, flexShrink:0 }}>
      {items.map((g, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:6, height: rowH }}>
          <span style={{ width: labelW, fontSize: labelFs, color:"#8080b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flexShrink:0 }}>{g.genre_name}</span>
          <div style={{ flex:1, height: barH, borderRadius: barH/2, background:"#1a1f3a", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${(g.rating_count/maxC)*100}%`, background:"#5040a0", borderRadius: barH/2 }} />
          </div>
          <span style={{ width:32, fontSize: valueFs, color:"#5a5a8a", textAlign:"right", flexShrink:0 }}>{g.rating_count}</span>
        </div>
      ))}
    </div>
  );
}

function DecadeBars({ decadeStats, barH, labelFs }) {
  if (!decadeStats?.length) return null;
  const maxC = Math.max(...decadeStats.map(d => d.count), 1);
  return (
    <div style={{ flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"flex-end", gap:6, height: barH }}>
        {decadeStats.map((d) => (
          <div key={d.decade} style={{ flex:1, height:`${Math.max((d.count/maxC)*100, 5)}%`, borderRadius:"3px 3px 0 0", background: d.count===maxC ? "#6050c0" : "#2a2560", alignSelf:"flex-end" }} />
        ))}
      </div>
      <div style={{ display:"flex", gap:6, marginTop:4 }}>
        {decadeStats.map((d) => (
          <span key={d.decade} style={{ flex:1, textAlign:"center", fontSize: labelFs, color:"#3a3a6a" }}>{d.decade}s</span>
        ))}
      </div>
    </div>
  );
}

// ─── main preview component ────────────────────────────────────────────────────

export function ProfileShareCard({ format = "square", profile, tier, favourites, basic, genreStats, decadeStats }) {
  const { width, height } = FORMATS[format] ?? FORMATS.square;
  const tierStyle = TIER_COLORS[tier] ?? TIER_COLORS.free;
  const initials = (profile?.username?.[0] ?? "?").toUpperCase();
  const tierLevel = getTierLevel(tier);
  const personality = genreStats?.length ? (PERSONALITY_MAP[genreStats[0].genre_name] ?? "Film Fanatic") : null;
  const now = new Date();
  const dateLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const isLarge = height >= 1700, isMedL = height >= 1200, isMed = height >= 900;

  const fs = {
    logoH:     isLarge ? 50 : isMedL ? 40 : isMed ? 33 : 26,
    date:      isLarge ? 24 : isMedL ? 20 : isMed ? 16 : 13,
    avatarSize:isLarge ? 110 : isMedL ? 90 : isMed ? 76 : 60,
    avatarFont:isLarge ? 50 : isMedL ? 40 : isMed ? 32 : 26,
    avatarGap: isLarge ? 28 : isMedL ? 22 : isMed ? 18 : 14,
    username:  isLarge ? 50 : isMedL ? 40 : isMed ? 33 : 26,
    badge:     isLarge ? 21 : isMedL ? 17 : isMed ? 13 : 11,
    bio:       isLarge ? 24 : isMedL ? 20 : isMed ? 16 : 13,
    posterGap: isLarge ? 18 : isMedL ? 14 : isMed ? 12 : 8,
    posterR:   isLarge ? 20 : isMedL ? 16 : 12,
    statH:     isLarge ? 144 : isMedL ? 118 : isMed ? 96 : 74,
    statGap:   isLarge ? 18 : isMedL ? 14 : isMed ? 11 : 8,
    statR:     isLarge ? 20 : isMedL ? 16 : isMed ? 13 : 10,
    statVal:   isLarge ? 60 : isMedL ? 50 : isMed ? 38 : 27,
    statLabel: isLarge ? 18 : isMedL ? 14 : isMed ? 11 : 9,
    histH:     isLarge ? 100 : isMedL ? 78 : isMed ? 62 : 44,
    histAvg:   isLarge ? 20 : isMedL ? 16 : isMed ? 13 : 10,
    genreRow:  isLarge ? 34 : isMedL ? 28 : isMed ? 24 : 20,
    genreLabel:isLarge ? 20 : isMedL ? 16 : isMed ? 13 : 10,
    genreVal:  isLarge ? 18 : isMedL ? 14 : isMed ? 12 : 10,
    genreLabelW:isLarge ? 175 : isMedL ? 155 : isMed ? 140 : 115,
    decadeH:   isLarge ? 70 : isMedL ? 56 : isMed ? 46 : 36,
    decadeLabel:isLarge ? 18 : isMedL ? 15 : isMed ? 13 : 10,
    persIcon:  isLarge ? 48 : isMedL ? 38 : isMed ? 32 : 26,
    persLabel: isLarge ? 20 : isMedL ? 16 : isMed ? 13 : 10,
    pers:      isLarge ? 42 : isMedL ? 32 : isMed ? 26 : 20,
    footer:    isLarge ? 22 : isMedL ? 18 : isMed ? 15 : 12,
  };

  const pad = format==="story"?80 : format==="portrait"?68 : format==="square"?54 : format==="landscape"?38 : 30;
  const gap = format==="story"?64 : format==="portrait"?52 : format==="square"?36 : format==="landscape"?22 : 20;
  const innerW = width - pad*2;

  const histogram = basic?.histogram ?? {};
  const histTotal = basic?.total ?? 0;
  const maxBar = histTotal > 0 ? Math.max(...Object.values(histogram), 1) : 1;

  const favCount = Math.max((favourites ?? []).length, 1);
  const posterSlotW = (innerW - fs.posterGap * (favCount - 1)) / favCount;
  const posterH = Math.round(posterSlotW * 1.5);

  const statBox = { h: fs.statH, r: fs.statR, val: fs.statVal, label: fs.statLabel, gap: isMed ? 8 : 5 };
  const statBox2x2 = { h: Math.round(fs.statH*0.88), r: fs.statR, val: Math.round(fs.statVal*0.9), label: fs.statLabel, gap: isMed ? 8 : 5 };

  const genreTopN = format==="story" ? 5 : format==="square" ? 3 : 4;
  const showDecade = tierLevel === "pro" && decadeStats?.length && format !== "square";
  const showGenre = tierLevel !== "free" && genreStats?.length;
  const showPersonality = !["wide","landscape"].includes(format) || format === "landscape";

  // Landscape and Wide have separate layouts in canvas but for the preview we use the same
  // vertical structure — it's a preview, not a pixel-perfect replica.

  return (
    <div style={{
      width, height,
      background: "linear-gradient(150deg, #0e1028 0%, #0a0c18 55%, #080918 100%)",
      fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
      overflow: "hidden", position: "relative",
      display: "flex", flexDirection: "column",
      padding: pad, boxSizing: "border-box", gap,
    }}>
      {/* Glow */}
      <div style={{ position:"absolute", top:-height*0.12, right:-width*0.08, width:width*0.55, height:width*0.55, borderRadius:"50%", background:"radial-gradient(circle,rgba(100,80,200,0.16) 0%,transparent 70%)", pointerEvents:"none" }} />

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <img src="/assets/banner.png" alt="watchpapa" style={{ height: fs.logoH, objectFit:"contain" }} />
        <span style={{ fontSize: fs.date, color:"#3a3a6a", fontWeight:600, letterSpacing:"0.08em" }}>{dateLabel}</span>
      </div>

      {/* User */}
      <div style={{ display:"flex", alignItems:"center", gap: fs.avatarGap, flexShrink:0 }}>
        <div style={{ width:fs.avatarSize, height:fs.avatarSize, borderRadius:"50%", background:"#1a1d35", border:"2px solid #3a3a7a", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#a0a0e8", fontSize:fs.avatarFont, fontWeight:700 }}>
          {initials}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, minWidth:0, flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap: isMed ? 14 : 8, flexWrap:"wrap" }}>
            <span style={{ fontSize:fs.username, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth: innerW - fs.avatarSize - fs.avatarGap - 160 }}>
              @{profile?.username}
            </span>
            <span style={{ background:tierStyle.bg, border:`1px solid ${tierStyle.border}`, color:tierStyle.text, fontSize:fs.badge, fontWeight:700, padding:`${fs.badge*0.42}px ${fs.badge*0.75}px`, borderRadius:100, letterSpacing:"0.04em", flexShrink:0 }}>
              {TIER_LABELS[tier] ?? tier}
            </span>
          </div>
          {profile?.bio && (
            <span style={{ fontSize:fs.bio, color:"#7070a8", lineHeight:1.5, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
              {profile.bio}
            </span>
          )}
        </div>
      </div>

      {/* Poster hero */}
      <div style={{ display:"flex", gap:fs.posterGap, flexShrink:0 }}>
        {(favourites ?? []).length > 0 ? (favourites ?? []).map((fav, i) => {
          const item = fav.movie_id != null ? fav.movie : fav.show;
          const posterPath = item?.poster_path;
          const title = item?.title ?? item?.name;
          return (
            <div key={i} style={{ flex:1, height:posterH, borderRadius:fs.posterR, overflow:"hidden", background:"#0d0f20", border:"1px solid #1a1f3a" }}>
              {posterPath ? (
                <img src={`https://image.tmdb.org/t/p/w342${posterPath}`} alt={title ?? ""} style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }} />
              ) : (
                <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:"#2a2f5a", fontSize:14 }}>{title ?? "?"}</div>
              )}
            </div>
          );
        }) : (
          <div style={{ flex:1, height:posterH, display:"flex", alignItems:"center", justifyContent:"center", color:"#2a2f5a", fontSize:isMed?18:13, fontStyle:"italic", borderRadius:fs.posterR, border:"1px dashed #1a1f3a" }}>
            No favourites set
          </div>
        )}
      </div>

      {/* Stats — story uses 4-row, square/portrait use 2×2 */}
      {basic && format === "story" ? (
        <div style={{ display:"flex", gap:fs.statGap, flexShrink:0 }}>
          {[[basic.total,"Rated"],[basic.avg!=null?`${basic.avg}/10`:"—","Avg"],[basic.movieCount,"Movies"],[basic.showCount,"Shows"]].map(([v,l]) => (
            <StatBox key={l} val={v} label={l} style={statBox} />
          ))}
        </div>
      ) : basic ? (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:fs.statGap, flexShrink:0 }}>
          {[[basic.total,"Rated"],[basic.avg!=null?`${basic.avg}/10`:"—","Avg"],[basic.movieCount,"Movies"],[basic.showCount,"Shows"]].map(([v,l]) => (
            <StatBox key={l} val={v} label={l} style={statBox2x2} />
          ))}
        </div>
      ) : null}

      {/* Histogram */}
      {basic && histTotal > 0 && (
        <div style={{ flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:fs.histH }}>
            {[1,2,3,4,5,6,7,8,9,10].map((v) => {
              const cnt = histogram[v] ?? 0;
              const hPct = cnt > 0 ? (cnt/maxBar)*100 : 2;
              return (
                <div key={v} style={{ flex:1, height:`${Math.max(hPct, cnt>0?8:2)}%`, borderRadius:"4px 4px 0 0", alignSelf:"flex-end", background: cnt===maxBar&&cnt>0 ? "#6050c0" : "#2a2560" }} />
              );
            })}
          </div>
          <div style={{ fontSize:fs.histAvg, color:"#505080", marginTop:10 }}>
            {basic.avg!=null ? `avg ${basic.avg}/10 · ` : ""}{histTotal} rating{histTotal!==1?"s":""}
          </div>
        </div>
      )}

      {/* Genre bars — Premium+ */}
      {showGenre && (
        <GenreBars genreStats={genreStats} topN={genreTopN} labelW={fs.genreLabelW} rowH={fs.genreRow} labelFs={fs.genreLabel} barH={isMed?9:7} valueFs={fs.genreVal} />
      )}

      {/* Decade bars — Pro+ */}
      {showDecade && (
        <DecadeBars decadeStats={decadeStats} barH={fs.decadeH} labelFs={fs.decadeLabel} />
      )}

      {/* Personality — emoji left, stacked label+value right (matches canvas output) */}
      {personality && showPersonality && (
        <div style={{ display:"flex", alignItems:"center", gap: isMed?18:12, flexShrink:0, borderTop:"1px solid #1a1f3a", paddingTop: isMed?26:16 }}>
          <span style={{ fontSize:fs.persIcon, flexShrink:0 }}>🎭</span>
          <div style={{ display:"flex", flexDirection:"column", gap: Math.round(fs.persLabel*0.35) }}>
            <span style={{ fontSize:fs.persLabel, color:"#4a4a7a", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>Your vibe</span>
            <span style={{ fontSize:fs.pers, fontWeight:800, color:"#a090ff", letterSpacing:"-0.01em" }}>{personality}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop:"auto", display:"flex", alignItems:"center", justifyContent:"center", gap:12, flexShrink:0 }}>
        <div style={{ width:isMed?6:4, height:isMed?6:4, borderRadius:"50%", background:"#2a2f5a" }} />
        <span style={{ fontSize:fs.footer, color:"#2a2f5a", fontWeight:600, letterSpacing:"0.06em" }}>watchpapa.tv</span>
        <div style={{ width:isMed?6:4, height:isMed?6:4, borderRadius:"50%", background:"#2a2f5a" }} />
      </div>
    </div>
  );
}
