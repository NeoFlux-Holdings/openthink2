/**
 * Table viewer — sortable / filterable data table with CSV export.
 * Rows are `Record<string, string | number>[]`; columns can be passed
 * explicitly or inferred from the first row.
 */
import { useMemo, useState, type ChangeEvent } from "react";
import type { TableData, TableRow } from "./types";

export interface TableViewProps {
  data?: TableData | undefined;
  filename?: string | undefined;
}

type SortDir = "asc" | "desc";

interface SortState {
  column: string;
  direction: SortDir;
}

/**
 * Build a CSV string. Cells are quoted if they contain commas, quotes,
 * or newlines; embedded quotes are doubled per RFC 4180.
 */
export function buildCsv(columns: string[], rows: TableRow[]): string {
  const escape = (value: string | number | undefined): string => {
    if (value === undefined || value === null) return "";
    const s = String(value);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = columns.map(escape).join(",");
  const body = rows.map((row) => columns.map((col) => escape(row[col])).join(",")).join("\n");
  return body.length > 0 ? `${header}\n${body}` : header;
}

export function inferColumns(rows: TableRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) seen.add(key);
  }
  return Array.from(seen);
}

export function TableView(props: TableViewProps) {
  const rows = props.data?.rows ?? [];
  const columns = useMemo(
    () => props.data?.columns ?? inferColumns(rows),
    [props.data?.columns, rows]
  );
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);

  const onQuery = (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((row) => columns.some((c) => String(row[c] ?? "").toLowerCase().includes(q)))
      : rows.slice();
    if (sort) {
      const { column, direction } = sort;
      filtered.sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        if (typeof av === "number" && typeof bv === "number") {
          return direction === "asc" ? av - bv : bv - av;
        }
        const as = String(av ?? "");
        const bs = String(bv ?? "");
        return direction === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
      });
    }
    return filtered;
  }, [rows, columns, query, sort]);

  const toggleSort = (column: string) => {
    setSort((prev) => {
      if (!prev || prev.column !== column) return { column, direction: "asc" };
      if (prev.direction === "asc") return { column, direction: "desc" };
      return null;
    });
  };

  const onExport = () => {
    const csv = buildCsv(columns, filteredSorted);
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = props.filename ?? "table.csv";
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <section className="pv-table" aria-label="Data table">
      <header className="pv-table__bar">
        <input
          type="search"
          className="pv-table__search"
          placeholder="Filter rows…"
          value={query}
          onChange={onQuery}
          aria-label="Filter rows"
        />
        <button type="button" className="pv-table__btn" onClick={onExport}>
          Export CSV
        </button>
      </header>

      <div className="pv-table__scroller">
        <table className="pv-table__grid">
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort?.column === col;
                const arrow = !active ? "" : sort?.direction === "asc" ? " ▲" : " ▼";
                return (
                  <th key={col} scope="col">
                    <button type="button" className="pv-table__sort" onClick={() => toggleSort(col)}>
                      {col}
                      {arrow}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col}>{String(row[col] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredSorted.length === 0 && (
        <p className="pv-table__empty">No rows match.</p>
      )}
    </section>
  );
}

export default TableView;
