import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckSquare } from 'lucide-react';
import { compareTableValues } from '../../core/clinic/clinicHelpers';
import { Pagination } from './Pagination';
import {
  tableBodyClass,
  tableCellClass,
  tableHeadClass,
  tableHeadRowClass,
  tableHeaderButtonClass,
  tableRowClass,
  tableThClass,
  tableWrapperClass,
} from './uiClasses';

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<T> {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  sortValue?: (row: T) => unknown;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T) => React.ReactNode;
}

export interface DataTableSortState {
  columnId: string;
  direction: SortDirection;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (visibleIds: string[]) => void;
  bulkActions?: React.ReactNode;
  emptyState?: React.ReactNode;
  defaultSort?: DataTableSortState | null;
  sortState?: DataTableSortState | null;
  onSortChange?: (next: DataTableSortState | null) => void;
  ariaLabel?: string;
  paginated?: boolean;
  defaultPageSize?: number;
  page?: number;
  onPageChange?: (nextPage: number) => void;
  pageSize?: number;
  onPageSizeChange?: (nextPageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export function serializeSortState(sort: DataTableSortState | null | undefined): string | null {
  return sort ? `${sort.columnId}:${sort.direction}` : null;
}

export function parseSortState(raw: string | null | undefined): DataTableSortState | null {
  if (!raw) return null;
  const idx = raw.lastIndexOf(':');
  if (idx <= 0) return null;
  const columnId = raw.slice(0, idx);
  const direction = raw.slice(idx + 1);
  if (direction !== 'asc' && direction !== 'desc') return null;
  return { columnId, direction };
}

export function SortHeaderIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection | null;
}) {
  if (!active || !direction) {
    return (
      <ArrowUpDown
        className="w-3.5 h-3.5 text-slate-400/80 group-hover:text-teal-600 dark:group-hover:text-teal-400 shrink-0 transition-colors"
        aria-hidden="true"
      />
    );
  }
  return direction === 'asc' ? (
    <ArrowUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
  ) : (
    <ArrowDown className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
  );
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  onRowClick,
  rowClassName,
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  bulkActions,
  emptyState,
  defaultSort = null,
  sortState: controlledSortState,
  onSortChange,
  ariaLabel,
  paginated = true,
  defaultPageSize = 25,
  page: controlledPage,
  onPageChange,
  pageSize: controlledPageSize,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  itemLabel = 'registros',
}: DataTableProps<T>) {
  const [internalSortState, setInternalSortState] = useState<DataTableSortState | null>(
    defaultSort
  );
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);

  const sortState = controlledSortState !== undefined ? controlledSortState : internalSortState;
  const currentPage = controlledPage !== undefined ? controlledPage : internalPage;
  const pageSize = controlledPageSize !== undefined ? controlledPageSize : internalPageSize;

  const commitPage = (nextPage: number) => {
    if (onPageChange) onPageChange(nextPage);
    else setInternalPage(nextPage);
  };

  const commitPageSize = (nextSize: number) => {
    if (onPageSizeChange) onPageSizeChange(nextSize);
    else setInternalPageSize(nextSize);
  };

  const commitSort = (nextSort: DataTableSortState | null) => {
    if (onSortChange) onSortChange(nextSort);
    else setInternalSortState(nextSort);
  };

  const sortedData = useMemo(() => {
    if (!sortState) return data;
    const col = columns.find((c) => c.id === sortState.columnId);
    if (!col || col.sortable === false) return data;
    const getVal = col.sortValue ?? ((row: T) => (row as Record<string, unknown>)[col.id]);
    const copy = [...data];
    copy.sort((a, b) => {
      const cmp = compareTableValues(getVal(a), getVal(b));
      return sortState.direction === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [data, columns, sortState]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  useEffect(() => {
    if (sortedData.length > 0 && currentPage > totalPages) {
      commitPage(totalPages);
    }
  }, [sortedData.length, currentPage, totalPages]);

  const pagedData = useMemo(() => {
    if (!paginated) return sortedData;
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [paginated, sortedData, safePage, pageSize]);

  const handleSortClick = (colId: string) => {
    const nextSort: DataTableSortState | null =
      !sortState || sortState.columnId !== colId
        ? { columnId: colId, direction: 'asc' }
        : sortState.direction === 'asc'
        ? { columnId: colId, direction: 'desc' }
        : null;
    commitPage(1);
    commitSort(nextSort);
  };

  const visibleIds = useMemo(() => pagedData.map(getRowKey), [pagedData, getRowKey]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    selectable && visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someVisibleSelected =
    selectable && visibleIds.some((id) => selectedSet.has(id)) && !allVisibleSelected;

  if (sortedData.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="space-y-2.5">
      {selectable && selectedIds.length > 0 && bulkActions && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-teal-50/90 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/70 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 dark:text-teal-200">
            <CheckSquare className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>
              {selectedIds.length}{' '}
              {selectedIds.length === 1 ? 'elemento seleccionado' : 'elementos seleccionados'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">{bulkActions}</div>
        </div>
      )}

      <div className={tableWrapperClass}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse" aria-label={ariaLabel}>
            <thead className={tableHeadClass}>
              <tr className={tableHeadRowClass}>
                {selectable && (
                  <th className="w-10 px-3 py-2.5 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected;
                      }}
                      onChange={() => onToggleSelectAll?.(visibleIds)}
                      aria-label="Seleccionar todos los visibles"
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500 cursor-pointer align-middle"
                    />
                  </th>
                )}
                {columns.map((col) => {
                  const isSortable = col.sortable !== false;
                  const isSorted = sortState?.columnId === col.id;
                  const alignClass =
                    col.align === 'right'
                      ? 'text-right justify-end'
                      : col.align === 'center'
                      ? 'text-center justify-center'
                      : 'text-left justify-between';

                  return (
                    <th
                      key={col.id}
                      className={`${tableThClass} ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      } ${col.headerClassName ?? ''}`}
                    >
                      {isSortable ? (
                        <button
                          type="button"
                          onClick={() => handleSortClick(col.id)}
                          title={`Ordenar por ${col.label}`}
                          className={`${tableHeaderButtonClass} ${alignClass}`}
                        >
                          <span>{col.label}</span>
                          <SortHeaderIcon
                            active={isSorted}
                            direction={isSorted ? sortState!.direction : null}
                          />
                        </button>
                      ) : (
                        <span>{col.label}</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {pagedData.map((row) => {
                const rowId = getRowKey(row);
                const isSelected = selectable && selectedSet.has(rowId);
                return (
                  <tr
                    key={rowId}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`${tableRowClass} ${
                      isSelected ? '!bg-teal-50/75 dark:!bg-teal-950/35' : ''
                    } ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(row) : ''}`}
                  >
                    {selectable && (
                      <td
                        className="w-10 px-3 py-2.5 text-center align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect?.(rowId)}
                          aria-label={`Seleccionar fila ${rowId}`}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500 cursor-pointer align-middle"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={`${tableCellClass} ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        } ${col.cellClassName ?? ''}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {paginated && (
        <Pagination
          currentPage={safePage}
          totalItems={sortedData.length}
          pageSize={pageSize}
          onPageChange={commitPage}
          onPageSizeChange={(nextSize) => {
            commitPageSize(nextSize);
            commitPage(1);
          }}
          pageSizeOptions={pageSizeOptions}
          itemLabel={itemLabel}
        />
      )}
    </div>
  );
}
