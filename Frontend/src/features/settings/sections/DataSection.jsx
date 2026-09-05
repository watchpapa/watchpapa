import { useState } from "react";
import { apiFetch } from "../../../lib/api.js";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsRow from "../../../components/settings/SettingsRow.jsx";
import Button from "../../../components/ui/Button.jsx";
import { DownloadIcon, ImportIcon } from "../../../components/icons/index.jsx";

function DataSection({ session }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      // The Worker returns rows keyed by tmdb_id; hydrate title/year here, then
      // compose the watchpapa CSV client-side.
      const { ratings, watchlistItems } = await apiFetch("/api/import/export", { session });
      const ids = [...new Set([...ratings, ...watchlistItems].map((r) => Number(r.tmdb_id)))].map((id) => ({ type: "movie", id }));
      const cards = {};
      for (let i = 0; i < ids.length; i += 18) {
        const { cards: c } = await apiFetch("/api/content/batch", { session, method: "POST", body: JSON.stringify({ items: ids.slice(i, i + 18) }) });
        Object.assign(cards, c);
      }
      const meta = (tmdbId) => cards[`movie:${Number(tmdbId)}`] ?? {};
      const esc = (v) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = [];
      const ratedByTmdb = new Map(ratings.map((r) => [Number(r.tmdb_id), r]));
      const seen = new Set();
      for (const w of watchlistItems) {
        const m = meta(w.tmdb_id);
        seen.add(Number(w.tmdb_id));
        const rating = ratedByTmdb.get(Number(w.tmdb_id));
        rows.push([(w.added_at ?? "").slice(0, 10), m.title ?? "", m.year ?? "", "movie", w.watchlist_name, rating?.value ?? "", w.watched ? "true" : "false"]);
      }
      for (const r of ratings) {
        if (seen.has(Number(r.tmdb_id))) continue;
        const m = meta(r.tmdb_id);
        rows.push([(r.created_at ?? "").slice(0, 10), m.title ?? "", m.year ?? "", "movie", "", r.value, ""]);
      }
      const csv = "Date,Name,Year,MediaType,WatchlistName,Rating,Watched\n" + rows.map((row) => row.map(esc).join(",")).join("\n");
      const today = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `watchpapa-export-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e?.message ?? "Export failed. Please try again.");
    }
    setExporting(false);
  };

  return (
    <SettingsSection id="data" title="Your data">
      <SettingsRow label="Import" hint="From a Letterboxd export or a watchpapa CSV.">
        <Button to="/import" variant="secondary" size="md" icon={ImportIcon}>Import data</Button>
      </SettingsRow>
      <SettingsRow label="Export" hint="Ratings and watchlists in watchpapa CSV format.">
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button variant="secondary" size="md" icon={DownloadIcon} onClick={handleExport} loading={exporting}>
            {exporting ? "Preparing…" : "Download CSV"}
          </Button>
          {exportError && <p className="text-xs text-red-300">{exportError}</p>}
        </div>
      </SettingsRow>
    </SettingsSection>
  );
}

export default DataSection;
