export function escapeCsvField(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header, rows) {
  return (
    header.join(",") +
    "\n" +
    rows.map((row) => row.map(escapeCsvField).join(",")).join("\n")
  );
}
