import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { buttonClass, dropdownClass } from './uiClasses';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export function getPageRange(
  currentPage: number,
  totalPages: number
): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: Array<number | 'ellipsis'> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push('ellipsis');
  for (let p = start; p <= end; p++) {
    pages.push(p);
  }
  if (end < totalPages - 1) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  itemLabel = 'registros',
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  const visiblePages = useMemo(
    () => getPageRange(safePage, totalPages),
    [safePage, totalPages]
  );

  if (totalItems === 0) return null;
  if (totalPages <= 1 && !onPageSizeChange) return null;

  return (
    <div
      className={`no-print flex flex-col sm:flex-row sm:items-center justify-center sm:justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-xs ${className}`}
    >
      <div className="flex flex-wrap items-center justify-center sm:justify-start text-center sm:text-left gap-3 text-slate-600 dark:text-slate-300">
        <span className="font-mono tabular-nums">
          Mostrando{' '}
          <strong className="text-slate-900 dark:text-slate-100">
            {startItem}–{endItem}
          </strong>{' '}
          de{' '}
          <strong className="text-slate-900 dark:text-slate-100">{totalItems}</strong>{' '}
          {itemLabel}
        </span>

        {onPageSizeChange && (
          <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Filas por página"
              className={`${dropdownClass} min-h-[32px] py-1 px-2 text-[11px]`}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-center sm:justify-end gap-1 flex-wrap">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(1)}
            title="Primera página"
            aria-label="Primera página"
            className={buttonClass({ variant: 'icon', size: 'xs' })}
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            title="Página anterior"
            aria-label="Página anterior"
            className={buttonClass({ variant: 'icon', size: 'xs' })}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {visiblePages.map((item, idx) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1.5 text-slate-400 select-none"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === safePage ? 'page' : undefined}
                className={buttonClass({
                  variant: item === safePage ? 'primary' : 'ghost',
                  size: 'xs',
                  className: 'min-w-[32px] font-mono tabular-nums',
                })}
              >
                {item}
              </button>
            )
          )}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            title="Página siguiente"
            aria-label="Página siguiente"
            className={buttonClass({ variant: 'icon', size: 'xs' })}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            title="Última página"
            aria-label="Última página"
            className={buttonClass({ variant: 'icon', size: 'xs' })}
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </nav>
      )}
    </div>
  );
};
