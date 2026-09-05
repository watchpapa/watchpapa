import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { supabase } from "../../lib/supabase.js";
import { apiFetch } from "../../lib/api.js";

const RESOLVE_CHUNK = 10;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
const filmKey = (i) => i.uri?.trim().toLowerCase() || `${i.name.toLowerCase()}|||${i.year}`;

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let field = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++;
          break;
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      if (line[i] === ",") i++;
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length < 2) return [];
  const headers = parseCsvLine(nonEmpty[0]).map((h) => h.trim());
  return nonEmpty.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()]));
  });
}

// ── Format detection ──────────────────────────────────────────────────────────

function detectFormat(rows) {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]);
  if (keys.includes("MediaType") && keys.includes("WatchlistName")) return "watchpapa";
  if (keys.includes("Letterboxd URI")) {
    return keys.includes("Rating") ? "lb-ratings" : "lb-list";
  }
  return null;
}

// ── Parse into unified items ──────────────────────────────────────────────────

function parseLetterboxdRatings(rows) {
  return rows
    .filter((r) => r.Name && r.Year && r.Rating)
    .map((r) => ({
      name: r.Name,
      year: r.Year.slice(0, 4),
      uri: r["Letterboxd URI"]?.trim() || null,
      ratedAt: r.Date?.trim() || null,
      rating: Math.min(10, Math.max(1, Math.round(parseFloat(r.Rating) * 2))),
    }));
}

function parseLetterboxdList(rows) {
  return rows
    .filter((r) => r.Name && r.Year)
    .map((r) => ({
      name: r.Name,
      year: r.Year.slice(0, 4),
      uri: r["Letterboxd URI"]?.trim() || null,
    }));
}

function parseWatchpapaCsv(rows) {
  const ratings = [];
  const watchlistItems = [];
  for (const r of rows) {
    if (!r.Name || !r.Year) continue;
    const hasRating = r.Rating !== "" && r.Rating !== undefined;
    const hasWatchlist = r.WatchlistName !== "" && r.WatchlistName !== undefined;
    const isWatched = r.Watched === "true";
    if (hasRating) {
      const val = parseInt(r.Rating, 10);
      if (!isNaN(val) && val >= 1 && val <= 10) {
        ratings.push({ name: r.Name, year: r.Year.slice(0, 4), rating: val });
      }
    }
    if (hasWatchlist) {
      watchlistItems.push({
        name: r.Name,
        year: r.Year.slice(0, 4),
        watchlistName: r.WatchlistName,
        watched: isWatched,
      });
    }
  }
  return { ratings, watchlistItems };
}

// ── Step UI helpers ───────────────────────────────────────────────────────────

function StepNumber({ n, active, done }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition
        ${done ? "border-emerald-600 bg-emerald-900/40 text-emerald-400" :
          active ? "border-[#6868b8] bg-[#1a1d35] text-[#a0a0e8]" :
          "border-[#2a2d50] bg-[#0d0f1e] text-[#4a4a70]"}`}
    >
      {done ? "✓" : n}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const STEPS = { SOURCE: 0, UPLOAD: 1, CONFIGURE: 2, DONE: 3 };

export default function ImportPage({ session }) {
  const uid = session?.user?.id;

  // Step state
  const [step, setStep] = useState(STEPS.SOURCE);
  const [source, setSource] = useState(null); // 'letterboxd' | 'watchpapa'

  // Parsed data
  const [lbRatings, setLbRatings] = useState([]); // [{name, year, rating}]
  const [lbWatchlist, setLbWatchlist] = useState([]); // [{name, year}]
  const [lbWatched, setLbWatched] = useState([]); // [{name, year}]
  const [parseError, setParseError] = useState(null);

  // Configuration
  const [includeRatings, setIncludeRatings] = useState(true);
  const [includeWatchlist, setIncludeWatchlist] = useState(true);
  const [includeWatched, setIncludeWatched] = useState(true);
  const [conflictMode, setConflictMode] = useState("skip");
  const [watchlists, setWatchlists] = useState([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState("");
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [watchlistsLoading, setWatchlistsLoading] = useState(false);

  // Resolve + commit
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);
  const [progress, setProgress] = useState(null); // { done, total }
  const [startCounts, setStartCounts] = useState(null); // { ratingsImported, watchlistAdded, unresolved }

  const fileInputRef = useRef(null);

  // Load user's watchlists when reaching configure step
  useEffect(() => {
    if (step !== STEPS.CONFIGURE || !uid) return;
    setWatchlistsLoading(true);
    supabase
      .from("watchlist")
      .select("id, name")
      .eq("profile_id", uid)
      .order("created_at")
      .then(({ data }) => {
        setWatchlists(data ?? []);
        if (data?.length > 0) setSelectedWatchlistId(String(data[0].id));
        else {
          setSelectedWatchlistId("new");
          setNewWatchlistName(source === "letterboxd" ? "Letterboxd Import" : "Watchpapa Import");
        }
        setWatchlistsLoading(false);
      });
  }, [step, uid, source]);

  const handleFiles = useCallback((files) => {
    setParseError(null);
    const fileArr = Array.from(files);

    if (source === "watchpapa") {
      const f = fileArr[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const rows = parseCsv(e.target.result);
        const fmt = detectFormat(rows);
        if (fmt !== "watchpapa") {
          setParseError("This doesn't look like a watchpapa CSV. Make sure you upload the exported file.");
          return;
        }
        const { ratings, watchlistItems } = parseWatchpapaCsv(rows);
        setLbRatings(ratings);
        setLbWatchlist(watchlistItems.filter((w) => !w.watched));
        setLbWatched(watchlistItems.filter((w) => w.watched));
        setStep(STEPS.CONFIGURE);
      };
      reader.readAsText(f);
      return;
    }

    // Letterboxd folder: find ratings.csv, watchlist.csv, watched.csv by name.
    // webkitdirectory gives relative paths like "letterboxd-user-date/ratings.csv".
    // We only want root-level files (no subdirectory like likes/, deleted/).
    const relevant = fileArr.filter((f) => {
      const parts = (f.webkitRelativePath || f.name).split("/");
      const name = parts[parts.length - 1].toLowerCase();
      const depth = parts.length; // 1 = direct file, 2 = one folder deep (root of zip), 3+ = subfolder
      return depth <= 2 && (name === "ratings.csv" || name === "watchlist.csv" || name === "watched.csv");
    });

    if (relevant.length === 0) {
      setParseError("No matching files found. Make sure you selected the unzipped Letterboxd folder (it should contain ratings.csv, watchlist.csv, watched.csv).");
      return;
    }

    let foundRatings = false, foundWatchlist = false, foundWatched = false;
    let pending = relevant.length;
    let errored = false;

    for (const f of relevant) {
      const fname = f.name.toLowerCase();
      const reader = new FileReader();
      reader.onload = (e) => {
        if (errored) return;
        const rows = parseCsv(e.target.result);

        if (fname === "ratings.csv") {
          setLbRatings(parseLetterboxdRatings(rows));
          foundRatings = true;
        } else if (fname === "watchlist.csv") {
          setLbWatchlist(parseLetterboxdList(rows));
          foundWatchlist = true;
        } else if (fname === "watched.csv") {
          setLbWatched(parseLetterboxdList(rows));
          foundWatched = true;
        }

        pending--;
        if (pending === 0) {
          if (!foundRatings && !foundWatchlist && !foundWatched) {
            setParseError("No recognizable Letterboxd CSV files found in that folder.");
            return;
          }
          setStep(STEPS.CONFIGURE);
        }
      };
      reader.onerror = () => {
        errored = true;
        setParseError("Failed to read a file. Please try again.");
      };
      reader.readAsText(f);
    }
  }, [source]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleStart = async () => {
    const ratingSrc = includeRatings
      ? lbRatings.map(({ name, year, rating, uri, ratedAt }) => ({ name, year, value: rating, uri: uri ?? null, ratedAt: ratedAt ?? null }))
      : [];
    const watchlistSrc = [
      ...(includeWatchlist ? lbWatchlist.map(({ name, year, uri }) => ({ name, year, watched: false, uri: uri ?? null })) : []),
      ...(includeWatched ? lbWatched.map(({ name, year, uri }) => ({ name, year, watched: true, uri: uri ?? null })) : []),
    ];

    if (ratingSrc.length === 0 && watchlistSrc.length === 0) {
      setStartError("Nothing to import. Select at least one data type above.");
      return;
    }

    const session_ = session;
    const watchlistId = selectedWatchlistId === "new" ? null : parseInt(selectedWatchlistId, 10);
    const newWatchlistName_ = selectedWatchlistId === "new" ? (newWatchlistName.trim() || "Imported List") : null;

    // 1. Unique films → resolve to tmdb ids in chunks.
    const uniqueMap = new Map(); // filmKey -> { name, year, uri }
    for (const it of [...ratingSrc, ...watchlistSrc]) {
      const k = filmKey(it);
      if (!uniqueMap.has(k)) uniqueMap.set(k, { name: it.name, year: it.year, uri: it.uri });
    }
    const uniqueFilms = [...uniqueMap.values()];

    setStarting(true);
    setStartError(null);
    setProgress({ done: 0, total: uniqueFilms.length });

    const resolved = new Map(); // filmKey -> tmdbId
    const unresolved = [];
    try {
      for (const group of chunk(uniqueFilms, RESOLVE_CHUNK)) {
        const { resolved: r, unresolved: u } = await apiFetch("/api/import/resolve", {
          session: session_,
          method: "POST",
          body: JSON.stringify({ items: group }),
        });
        for (const item of r ?? []) {
          const src = group.find((g) => g.name === item.name && g.year === item.year);
          if (src) resolved.set(filmKey(src), item.tmdbId);
        }
        for (const item of u ?? []) unresolved.push(`${item.name} (${item.year})`);
        setProgress((p) => ({ ...p, done: p.done + group.length }));
      }

      // 2. Build commit payload from resolved ids.
      const ratings = [];
      for (const it of ratingSrc) {
        const id = resolved.get(filmKey(it));
        if (id) ratings.push({ tmdbId: id, value: it.value, ratedAt: it.ratedAt });
      }
      const watchlistItems = [];
      for (const it of watchlistSrc) {
        const id = resolved.get(filmKey(it));
        if (id) watchlistItems.push({ tmdbId: id, watched: it.watched });
      }

      if (ratings.length === 0 && watchlistItems.length === 0) {
        setStartError("None of the films could be matched on TMDB.");
        setStarting(false);
        return;
      }

      // 3. Commit once.
      const body = await apiFetch("/api/import/commit", {
        session: session_,
        method: "POST",
        body: JSON.stringify({
          ratings,
          watchlistItems,
          watchlistId,
          newWatchlistName: newWatchlistName_,
          conflictMode,
        }),
      });
      setStartCounts({
        ratingsImported: body.ratingsImported ?? 0,
        ratingsSkipped: body.ratingsSkipped ?? 0,
        watchlistAdded: body.watchlistAdded ?? 0,
        watchlistSkipped: body.watchlistSkipped ?? 0,
        unresolved,
      });
      setStep(STEPS.DONE);
    } catch (e) {
      setStartError(e?.message ?? "Import failed. Please try again.");
    }
    setStarting(false);
    setProgress(null);
  };

  const hasWatchlistData = (lbWatchlist.length > 0) || (lbWatched.length > 0);

  const breadcrumbs = [
    { label: "Settings", to: "/settings" },
    { label: "Import data", to: "/import" },
  ];

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead title="Import data" path="/import" noindex />
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="flex items-center text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          <span className="mr-2.5 h-6 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#c084fc] to-[#6f6fdc]" aria-hidden />
          Import data
        </h1>

        {/* ── Step 0: Choose source ─────────────────────────────────────────── */}
        {step === STEPS.SOURCE && (
          <div className="space-y-3">
            <p className="text-sm text-[#8888c8]">
              Import your watch history, ratings, and watchlist from another service or from a previous watchpapa export.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => { setSource("letterboxd"); setStep(STEPS.UPLOAD); }}
                className="group rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18] p-5 text-left transition hover:border-[#4a4a8a] hover:bg-[#0d0f22]"
              >
                <p className="mb-1 font-semibold text-white group-hover:text-[#a0a0e8]">Letterboxd</p>
                <p className="text-xs text-[#5a5a78]">Import ratings, watchlist, and watched history from your Letterboxd data export.</p>
              </button>
              <button
                onClick={() => { setSource("watchpapa"); setStep(STEPS.UPLOAD); }}
                className="group rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18] p-5 text-left transition hover:border-[#4a4a8a] hover:bg-[#0d0f22]"
              >
                <p className="mb-1 font-semibold text-white group-hover:text-[#a0a0e8]">watchpapa CSV</p>
                <p className="text-xs text-[#5a5a78]">Re-import a previously exported watchpapa CSV file.</p>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Upload ────────────────────────────────────────────────── */}
        {step === STEPS.UPLOAD && source === "letterboxd" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18] p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#6868b8]">How to export from Letterboxd</h2>
              <ol className="space-y-3 text-sm text-[#c0c0e8]">
                <li className="flex gap-3">
                  <StepNumber n={1} />
                  <span>Go to <span className="font-mono text-[#a0a0e8]">letterboxd.com</span>.</span>
                </li>
                <li className="flex gap-3">
                  <StepNumber n={2} />
                  <span>Go to <strong>Settings</strong>.</span>
                </li>
                <li className="flex gap-3">
                  <StepNumber n={3} />
                  <span>Open the <strong>DATA</strong> tab.</span>
                </li>
                <li className="flex gap-3">
                  <StepNumber n={4} />
                  <span>Press <strong>Export your data</strong> and wait for the email with a download link.</span>
                </li>
                <li className="flex gap-3">
                  <StepNumber n={5} />
                  <span>Download and <strong>unzip</strong> the file. You'll get a folder containing several CSV files.</span>
                </li>
                <li className="flex gap-3">
                  <StepNumber n={6} />
                  <span>Click the upload area below and <strong>select the unzipped folder</strong> — watchpapa will find the right files automatically.</span>
                </li>
              </ol>
            </div>

            <DropZone
              label="Select your unzipped Letterboxd folder"
              folder
              fileInputRef={fileInputRef}
              onFiles={handleFiles}
              onDrop={handleDrop}
            />
            {parseError && <p className="text-sm text-red-400">{parseError}</p>}

            <button
              onClick={() => setStep(STEPS.SOURCE)}
              className="text-xs text-[#6868b8] underline hover:text-white"
            >
              ← Back
            </button>
          </div>
        )}

        {step === STEPS.UPLOAD && source === "watchpapa" && (
          <div className="space-y-5">
            <p className="text-sm text-[#8888c8]">
              Upload a <strong className="text-[#c0c0e8]">watchpapa-export-*.csv</strong> file you downloaded from Settings.
            </p>

            <DropZone
              label="Select your watchpapa CSV file"
              multiple={false}
              fileInputRef={fileInputRef}
              onFiles={handleFiles}
              onDrop={handleDrop}
            />
            {parseError && <p className="text-sm text-red-400">{parseError}</p>}

            <button
              onClick={() => setStep(STEPS.SOURCE)}
              className="text-xs text-[#6868b8] underline hover:text-white"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Step 2: Configure ─────────────────────────────────────────────── */}
        {step === STEPS.CONFIGURE && (
          <div className="space-y-4">
            {/* Data preview */}
            <div className="rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18]">
              <div className="border-b border-[#2a3570]/50 px-5 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-[#6868b8]">Detected data</h2>
              </div>
              <div className="divide-y divide-[#2a3570]/40">
                <label className="flex cursor-pointer items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#c0c0e8]">Ratings</p>
                    <p className="text-xs text-[#5a5a78]">{lbRatings.length} film{lbRatings.length !== 1 ? "s" : ""}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeRatings}
                    onChange={(e) => setIncludeRatings(e.target.checked)}
                    disabled={lbRatings.length === 0}
                    className="h-4 w-4 accent-[#6868b8]"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#c0c0e8]">Watchlist</p>
                    <p className="text-xs text-[#5a5a78]">{lbWatchlist.length} film{lbWatchlist.length !== 1 ? "s" : ""} to watch</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeWatchlist}
                    onChange={(e) => setIncludeWatchlist(e.target.checked)}
                    disabled={lbWatchlist.length === 0}
                    className="h-4 w-4 accent-[#6868b8]"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#c0c0e8]">Watched history</p>
                    <p className="text-xs text-[#5a5a78]">{lbWatched.length} film{lbWatched.length !== 1 ? "s" : ""} already seen</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeWatched}
                    onChange={(e) => setIncludeWatched(e.target.checked)}
                    disabled={lbWatched.length === 0}
                    className="h-4 w-4 accent-[#6868b8]"
                  />
                </label>
              </div>
            </div>

            {/* Rating conflict */}
            {includeRatings && lbRatings.length > 0 && (
              <div className="rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18]">
                <div className="border-b border-[#2a3570]/50 px-5 py-4">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-[#6868b8]">Rating conflicts</h2>
                </div>
                <div className="space-y-0 divide-y divide-[#2a3570]/40">
                  <label className="flex cursor-pointer items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#c0c0e8]">Skip existing ratings</p>
                      <p className="text-xs text-[#5a5a78]">Keep your current watchpapa ratings unchanged</p>
                    </div>
                    <input type="radio" name="conflict" value="skip" checked={conflictMode === "skip"} onChange={() => setConflictMode("skip")} className="accent-[#6868b8]" />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#c0c0e8]">Overwrite existing ratings</p>
                      <p className="text-xs text-[#5a5a78]">Replace your watchpapa ratings with imported ones</p>
                    </div>
                    <input type="radio" name="conflict" value="overwrite" checked={conflictMode === "overwrite"} onChange={() => setConflictMode("overwrite")} className="accent-[#6868b8]" />
                  </label>
                </div>
              </div>
            )}

            {/* Watchlist target */}
            {hasWatchlistData && (
              <div className="rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18]">
                <div className="border-b border-[#2a3570]/50 px-5 py-4">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-[#6868b8]">Watchlist destination</h2>
                </div>
                <div className="px-5 py-4 space-y-3">
                  {watchlistsLoading ? (
                    <span className="text-sm text-[#5a5a78]">Loading watchlists…</span>
                  ) : (
                    <>
                      <select
                        value={selectedWatchlistId}
                        onChange={(e) => setSelectedWatchlistId(e.target.value)}
                        className="w-full rounded-xl border border-[#2a3570] bg-[#12163a] px-3 py-2 text-sm text-white outline-none focus:border-[#6868b8] transition"
                      >
                        {watchlists.map((w) => (
                          <option key={w.id} value={String(w.id)}>{w.name}</option>
                        ))}
                        <option value="new">+ Create new watchlist</option>
                      </select>
                      {selectedWatchlistId === "new" && (
                        <input
                          type="text"
                          value={newWatchlistName}
                          onChange={(e) => setNewWatchlistName(e.target.value)}
                          placeholder="Watchlist name"
                          maxLength={100}
                          className="w-full rounded-xl border border-[#2a3570] bg-[#12163a] px-3 py-2 text-sm text-white placeholder-[#4a4a8a] outline-none focus:border-[#6868b8] transition"
                        />
                      )}
                      <p className="text-xs text-[#5a5a78]">
                        Items already in the selected watchlist will be skipped (or upgraded to watched if applicable).
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {startError && <p className="text-sm text-red-400">{startError}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={handleStart}
                disabled={starting}
                className="rounded-xl border border-[#6868b8] bg-[#1a1d35] px-5 py-2.5 text-sm font-semibold text-[#a0a0e8] transition hover:border-[#9b9bf0] hover:text-white disabled:opacity-50"
              >
                {starting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#3a3a7a] border-t-[#8383e7]" />
                    {progress ? `Matching ${progress.done}/${progress.total}…` : "Importing…"}
                  </span>
                ) : "Start import"}
              </button>
              <button
                onClick={() => { setStep(STEPS.UPLOAD); setParseError(null); }}
                className="text-xs text-[#6868b8] underline hover:text-white"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ─────────────────────────────────────────────────── */}
        {step === STEPS.DONE && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-5 space-y-2">
              <p className="font-semibold text-emerald-400">Import complete</p>
              <p className="text-sm text-[#8888c8]">
                {startCounts ? (
                  <>
                    <span className="text-white font-medium">{startCounts.ratingsImported}</span> rating{startCounts.ratingsImported !== 1 ? "s" : ""} imported
                    {startCounts.ratingsSkipped > 0 && <> ({startCounts.ratingsSkipped} skipped)</>}
                    {" · "}
                    <span className="text-white font-medium">{startCounts.watchlistAdded}</span> watchlist item{startCounts.watchlistAdded !== 1 ? "s" : ""} added
                    {startCounts.watchlistSkipped > 0 && <> ({startCounts.watchlistSkipped} skipped)</>}.
                  </>
                ) : "Your data has been imported."}
              </p>
              {startCounts?.unresolved?.length > 0 && (
                <details className="text-xs text-[#6868b8]">
                  <summary className="cursor-pointer">
                    {startCounts.unresolved.length} film{startCounts.unresolved.length !== 1 ? "s" : ""} couldn&apos;t be matched on TMDB
                  </summary>
                  <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto">
                    {startCounts.unresolved.map((u) => <li key={u}>{u}</li>)}
                  </ul>
                </details>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/watchlists"
                className="rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-4 py-2 text-sm font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white"
              >
                View watchlists
              </Link>
              <Link
                to="/settings"
                className="rounded-xl border border-[#2a2d50] bg-[#0d0f1e] px-4 py-2 text-sm text-[#6868b8] transition hover:text-white"
              >
                Back to Settings
              </Link>
              <button
                onClick={() => {
                  setStep(STEPS.SOURCE);
                  setSource(null);
                  setLbRatings([]); setLbWatchlist([]); setLbWatched([]);
                  setStartError(null); setStartCounts(null);
                  setParseError(null);
                }}
                className="text-xs text-[#6868b8] underline hover:text-white self-center"
              >
                Import more
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({ label, folder, fileInputRef, onFiles, onDrop }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { setDragging(false); onDrop(e); }}
      onClick={() => fileInputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition
        ${dragging ? "border-[#6868b8] bg-[#0d0f22]" : "border-[#2a2d50] bg-[#0a0c18] hover:border-[#4a4a8a]"}`}
    >
      {folder ? (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#4a4a8a]">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ) : (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#4a4a8a]">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      )}
      <p className="text-center text-sm text-[#8888c8]">{label}</p>
      <p className="text-xs text-[#5a5a78]">{folder ? "Drag & drop the folder or click to browse" : "Drag & drop or click to browse"}</p>
      <input
        ref={fileInputRef}
        type="file"
        accept={folder ? undefined : ".csv"}
        {...(folder ? { webkitdirectory: "", directory: "" } : { multiple: true })}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}
