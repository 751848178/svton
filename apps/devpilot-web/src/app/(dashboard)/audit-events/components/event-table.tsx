/**
 * 审计事件表格（@tanstack/react-table）
 *
 * 取代原裸 `<table>` + `.map()`：用 headless table 提供列定义与排序（按时间/动作）。
 * 仍复用现有 StatusTag 与格式化 util，保持视觉一致。
 */
'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { StatusTag } from '@/components/ui';
import type { AuditEvent } from '../types';
import { categoryLabels, statusLabels, riskLabels } from '../constants';
import { formatTarget, formatRunRef, formatDateTime } from '../utils';

interface EventTableProps {
  events: AuditEvent[];
}

export function EventTable({ events }: EventTableProps) {
  const t = useTranslations('auditEvents');
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<AuditEvent>[]>(
    () => [
      {
        id: 'occurredAt',
        header: t('time'),
        accessorFn: (row) => row.occurredAt,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDateTime(row.original.occurredAt)}
          </span>
        ),
      },
      {
        id: 'action',
        header: t('action'),
        cell: ({ row }) => {
          const event = row.original;
          return (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {categoryLabels[event.category] || event.category}
                </span>
                <StatusTag
                  status={event.risk}
                  variant="risk"
                  label={riskLabels[event.risk] || event.risk}
                />
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{event.action}</div>
              {event.summary ? (
                <div className="mt-1 text-xs text-muted-foreground">{event.summary}</div>
              ) : null}
            </>
          );
        },
      },
      {
        id: 'target',
        header: t('target'),
        cell: ({ row }) => {
          const event = row.original;
          return (
            <>
              <div className="font-medium">{formatTarget(event)}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {event.targetType}
                {event.targetId ? ` · ${event.targetId}` : ''}
              </div>
            </>
          );
        },
      },
      {
        id: 'scope',
        header: t('scope'),
        cell: ({ row }) => {
          const event = row.original;
          return (
            <div className="text-muted-foreground">
              <div>{event.project?.name || t('noProject')}</div>
              <div className="mt-1 text-xs">
                {event.environment?.name || event.environment?.key || t('noEnvironment')}
              </div>
            </div>
          );
        },
      },
      {
        id: 'actor',
        header: t('actor'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.actor?.name || row.original.actor?.email || '-'}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('statusLabel'),
        cell: ({ row }) => {
          const event = row.original;
          return (
            <>
              <StatusTag status={event.status} label={statusLabels[event.status] || event.status} />
              <div className="mt-2 text-xs text-muted-foreground">{formatRunRef(event)}</div>
            </>
          );
        },
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: events,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-lg border">
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
                        <span className="text-xs text-muted-foreground">
                          {{ asc: '▲', desc: '▼' }[header.column.getIsSorted() as string] || '↕'}
                        </span>
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
  );
}
