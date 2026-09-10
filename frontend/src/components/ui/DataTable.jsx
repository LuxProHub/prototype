import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 2D High-Density Operational Table Components
 */
export function DataTable({ children, className = '' }) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="data-table">
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '' }) {
  return (
    <thead className={className}>
      {children}
    </thead>
  );
}

export function TableRow({
  children,
  onClick,
  selected = false,
  className = '',
  tabIndex,
  onKeyDown,
  ...props
}) {
  return (
    <tr
      onClick={onClick}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      data-selected={selected ? 'true' : undefined}
      className={`${onClick ? 'cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  isNumeric = false,
  isValue = false,
  align = 'left',
  className = '',
  ...props
}) {
  const fontClass = isValue ? 'val' : isNumeric ? 'num' : '';
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <td className={`${fontClass} ${alignClass} ${className}`} {...props}>
      {children}
    </td>
  );
}

export function SortableHeader({
  label,
  columnKey,
  currentSort,
  currentDir,
  onSort,
  align = 'left',
  className = '',
}) {
  const isSorted = currentSort === columnKey;
  const nextDir = isSorted && currentDir === 'asc' ? 'desc' : 'asc';

  return (
    <th
      aria-sort={isSorted ? (currentDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onSort?.(columnKey, nextDir)}
      className={`${className} ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <div className={`inline-flex items-center gap-1.5 cursor-pointer select-none group ${align === 'right' ? 'justify-end w-full' : ''}`}>
        <span>{label}</span>
        <span className="shrink-0 text-[var(--text-3)] group-hover:text-[var(--text)] transition-colors">
          {isSorted ? (
            currentDir === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-[var(--accent)]" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-[var(--accent)]" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-60" />
          )}
        </span>
      </div>
    </th>
  );
}

export function TablePagination({
  from = 1,
  to = 25,
  total = 0,
  isCapped = false,
  page = 1,
  totalPages = 1,
  pageSize = 25,
  pageSizeOptions = [25, 50, 100],
  onPageChange,
  onPageSizeChange,
  className = '',
}) {
  return (
    <div className={`px-3 py-2 border-t border-[var(--edge)] bg-[var(--surface-2)] flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] ${className}`}>
      <div className="text-[var(--text-2)] num">
        {from.toLocaleString()}–{to.toLocaleString()} of {isCapped ? `${total.toLocaleString()}+` : total.toLocaleString()}
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-[var(--text-3)]">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="field h-7 pl-2 pr-1 text-[12px] num cursor-pointer"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="btn h-7 w-7"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="num text-[var(--text-2)] px-1 whitespace-nowrap">
            {page} <span className="text-[var(--text-3)]">/ {totalPages}</span>
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="btn h-7 w-7"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
