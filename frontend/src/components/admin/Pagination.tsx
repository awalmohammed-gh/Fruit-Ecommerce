import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { number } from "../../pages/admin/lib/format";
import ui from "./ui.module.css";

interface PaginationProps { page: number; totalPages: number; total: number; pageSize: number; noun: string; onChange: (page: number) => void }

export default function Pagination({ page, totalPages, total, pageSize, noun, onChange }: PaginationProps) {
  if (!total) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <nav className={ui.pagination} aria-label={`${noun} pages`}>
      <span>Showing <strong className={ui.num}>{number(first)}–{number(last)}</strong> of <span className={ui.num}>{number(total)}</span> {noun}</span>
      {totalPages > 1 && (
        <div className={ui.pageButtons}>
          <button type="button" className={`${ui.button} ${ui.secondary} ${ui.small}`} onClick={() => onChange(page - 1)} disabled={page <= 1}>
            <ChevronLeftIcon aria-hidden="true" /> Previous
          </button>
          <span className={ui.pageIndicator} aria-current="page">{page} / {totalPages}</span>
          <button type="button" className={`${ui.button} ${ui.secondary} ${ui.small}`} onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
            Next <ChevronRightIcon aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
