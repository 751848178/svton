/**
 * 审计事件表格（@tanstack/react-table）
 *
 * 用 headless table 提供列定义与排序；客户端分页，避免一次性渲染全量。
 * 列定义抽出到 event-columns.tsx。复用现有 StatusTag 与格式化 util，保持视觉一致。
 */
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui';
import type { AuditEvent } from '../types';
import { useEventColumns } from './event-columns';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

interface EventTableProps {
  events: AuditEvent[];
}

export function EventTable({ events }: EventTableProps) {
  const t = useTranslations('auditEvents');
  const columns = useEventColumns();
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: events,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    initialState: { pagination: { pageSize: 10 } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const { pageSize, pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-medium">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1"
                        disabled={!header.column.getCanSort()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() ? (
                          <SortIcon dir={header.column.getIsSorted() as false | 'asc' | 'desc'} />
                        ) : null}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="align-top hover:bg-muted/30">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{t('rowCount', { count: events.length })}</span>
          <span className="text-muted-foreground/60">·</span>
          <label className="flex items-center gap-1">
            {t('rowsPerPage')}
            <select
              value={pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="rounded-md border bg-background px-2 py-1"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <span>
            {t('pageOf', { page: pageCount > 0 ? pageIndex + 1 : 0, total: pageCount })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t('pagePrevious')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t('pageNext')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** 排序方向图标：升/降序显示实心箭头，未排序显示双向浅色图标。 */
function SortIcon({ dir }: { dir: false | 'asc' | 'desc' }) {
  if (dir === 'asc') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="text-muted-foreground">
        <path d="M6 3 L10 8 L2 8 Z" fill="currentColor" />
      </svg>
    );
  }
  if (dir === 'desc') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="text-muted-foreground">
        <path d="M6 9 L2 4 L10 4 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="text-muted-foreground/50">
      <path d="M6 1.5 L9 5 L3 5 Z" fill="currentColor" />
      <path d="M6 10.5 L3 7 L9 7 Z" fill="currentColor" />
    </svg>
  );
}
