import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  rows: T[];
  columns: ColumnDef<T>[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  headerExtra?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchPlaceholder = 'Rechercher...',
  searchFilter,
  pageSize = 8,
  emptyTitle = 'Aucune donnée disponible',
  emptyDescription = 'Ajoutez ou importez des enregistrements pour alimenter cette vue.',
  emptyAction,
  headerExtra,
  onRowClick,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !searchFilter) return rows;
    return rows.filter((r) => searchFilter(r, q));
  }, [rows, query, searchFilter]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb), 'fr')
        : String(vb).localeCompare(String(va), 'fr');
    });
    return copy;
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {(searchFilter || headerExtra) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          {searchFilter ? (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[#8B9299] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-sm bg-[#F3F4F6] border border-transparent focus:border-[#16834B] focus:bg-white rounded-lg outline-none text-[#27313B] transition-colors"
              />
            </div>
          ) : (
            <div />
          )}
          {headerExtra && <div className="flex flex-wrap items-center gap-2">{headerExtra}</div>}
        </div>
      )}

      {paginated.length === 0 ? (
        <div className="py-12 px-6 text-center">
          <p className="text-sm font-semibold text-[#27313B]">{emptyTitle}</p>
          <p className="text-xs text-[#8B9299] mt-1 max-w-md mx-auto">{emptyDescription}</p>
          {emptyAction && <div className="mt-4 flex justify-center">{emptyAction}</div>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-[#F9FAFB]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-2.5 text-xs font-semibold text-[#8B9299] whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.sortable && col.sortValue ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-[#27313B] transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>{col.label}</span>
                        {sortKey === col.key &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#16834B]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#16834B]" />
                          ))}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {paginated.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-[#E8F5ED]/40' : 'hover:bg-gray-50/80'
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-[#27313B] align-middle ${
                        col.align === 'right' ? 'text-right tabular-nums' : 'text-left'
                      }`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-xs text-[#8B9299]">
          <span className="tabular-nums">
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} sur {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50 text-[#27313B]"
              aria-label="Page précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-[#27313B] tabular-nums">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50 text-[#27313B]"
              aria-label="Page suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
