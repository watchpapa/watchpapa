import { cn } from "../../lib/cn.js";
import { Skeleton } from "./Skeleton.jsx";
import EmptyState from "./EmptyState.jsx";

const HIDE = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };

// Responsive data table: a real <table> from `md` up, stacked label/value cards
// below it (no horizontal scrolling on phones).
//
// columns: [{ key, label, render?(row), align?: "left"|"right"|"center",
//            hideBelow?: "sm"|"md"|"lg"|"xl"   // desktop table only
//            primary?: true                     // card title on phones
//            cardHidden?: true                  // omit from phone cards
//            className? }]
// rows: object[]; rowKey(row) → string; onRowClick?(row); cardActions?(row)
function DataTable({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  onRowClick,
  cardActions,
  className,
  dense = false,
  stickyHeader = false,
  skeletonRows = 5,
}) {
  const keyOf = (row, i) => (rowKey ? rowKey(row) : row.id ?? i);
  const cell = (col, row) => (col.render ? col.render(row) : row[col.key]);
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const pad = dense ? "px-3 py-2" : "px-4 py-3";

  if (!loading && rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} compact />;
  }

  return (
    <div className={cn("w-full", className)}>
      {/* md+: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border/50 bg-surface md:block">
        <table className="w-full table-auto border-collapse text-sm">
          <thead className={cn("bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-text-faint", stickyHeader && "sticky top-14 z-10")}>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(pad, "whitespace-nowrap font-semibold", c.hideBelow && HIDE[c.hideBelow], c.align === "right" && "text-right", c.align === "center" && "text-center", c.headerClassName)}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={`s${i}`}>
                    {columns.map((c) => (
                      <td key={c.key} className={cn(pad, c.hideBelow && HIDE[c.hideBelow])}>
                        <Skeleton className="h-3.5 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, i) => (
                  <tr
                    key={keyOf(row, i)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn("text-text transition", onRowClick && "cursor-pointer hover:bg-surface-2")}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(pad, "align-middle", c.hideBelow && HIDE[c.hideBelow], c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}
                      >
                        {cell(c, row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* <md: cards */}
      <ul className="space-y-2 md:hidden">
        {loading
          ? Array.from({ length: Math.min(skeletonRows, 4) }).map((_, i) => (
              <li key={`sc${i}`} className="rounded-2xl border border-border/50 bg-surface p-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-3 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-2/3" />
              </li>
            ))
          : rows.map((row, i) => (
              <li
                key={keyOf(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("rounded-2xl border border-border/50 bg-surface p-4", onRowClick && "cursor-pointer active:bg-surface-2")}
              >
                {primary && <div className="mb-2 text-sm font-semibold text-white">{cell(primary, row)}</div>}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  {columns
                    .filter((c) => c !== primary && !c.cardHidden)
                    .map((c) => (
                      <div key={c.key} className="contents">
                        <dt className="text-text-faint">{c.label}</dt>
                        <dd className={cn("min-w-0 break-words text-text", c.cardClassName)}>{cell(c, row)}</dd>
                      </div>
                    ))}
                </dl>
                {cardActions && <div className="mt-3 flex flex-wrap gap-2">{cardActions(row)}</div>}
              </li>
            ))}
      </ul>
    </div>
  );
}

export default DataTable;
