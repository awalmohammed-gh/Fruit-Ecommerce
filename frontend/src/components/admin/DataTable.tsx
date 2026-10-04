import { useAdminPreferences } from "../../context/AdminPreferencesContext";
import type { ReactNode } from "react";
import { EmptyState, ErrorState } from "./States";
import type { LucideIcon } from "lucide-react";
import ui from "./ui.module.css";

export interface Column<T> {
  key: string;
  /** Column heading; also the label shown beside the value when rows stack on phones. */
  header: string;
  render: (row: T) => ReactNode;
  align?: "right";
  /** The identifying cell (product, customer…) heads each stacked card on phones. */
  primary?: boolean;
}

interface DataTableProps<T> {
  label: string;
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty: { icon?: LucideIcon; title: string; text?: ReactNode; action?: ReactNode };
  rowTone?: (row: T) => "warning" | "danger" | undefined;
  /** Caps the height so long lists scroll under a sticky header. */
  tall?: boolean;
  skeletonRows?: number;
}

export default function DataTable<T>({
  label, columns, rows, rowKey, loading = false, error, onRetry, empty, rowTone, tall, skeletonRows = 6,
}: DataTableProps<T>) {
  const { preferences } = useAdminPreferences();
  const span = columns.length;
  const alignClass = (column: Column<T>) => (column.align === "right" ? ui.alignRight : undefined);

  let body: ReactNode;
  if (error && !rows?.length) {
    body = <tr><td colSpan={span}><ErrorState message={error} onRetry={onRetry} /></td></tr>;
  } else if (!rows) {
    body = Array.from({ length: skeletonRows }, (_, index) => (
      <tr key={index} aria-hidden="true">
        {columns.map((column) => <td key={column.key} data-label=""><span className={ui.skeletonCell} style={{ width: column.primary ? "70%" : "55%" }} /></td>)}
      </tr>
    ));
  } else if (!rows.length) {
    body = <tr><td colSpan={span} data-label=""><EmptyState {...empty} /></td></tr>;
  } else {
    body = rows.map((row) => {
      const tone = rowTone?.(row);
      return (
        <tr key={rowKey(row)} className={tone === "danger" ? ui.rowDanger : tone === "warning" ? ui.rowWarning : undefined}>
          {columns.map((column) => (
            <td key={column.key} className={alignClass(column)} data-label={column.header} data-primary={column.primary || undefined}>
              {column.render(row)}
            </td>
          ))}
        </tr>
      );
    });
  }

  return (
    <div className={`${ui.tableWrap} ${tall ? ui.tableTall : ""} ${loading && rows ? ui.refetching : ""}`} role="region" aria-label={label} aria-busy={loading} tabIndex={tall ? 0 : undefined}>
      {error && !!rows?.length && <div style={{ padding: "12px 20px 0" }}><ErrorState message={error} onRetry={onRetry} /></div>}
      <table className={`${ui.table} ${ui.stack} ${preferences.tableDensity === "compact" ? ui.compactTable : ""}`}>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>{columns.map((column) => <th key={column.key} scope="col" className={alignClass(column)}>{column.header}</th>)}</tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}
