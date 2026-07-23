/**
 * 资源申请列表表格（@tanstack/react-table）
 *
 * 单一职责：渲染申请列表 + 状态徽章 + 审批/取消/重试/交付/运行记录操作。
 * 头部采用 headless table 提供按创建时间/状态排序。
 */
'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ResourceRequest } from '../types';
import {
  getStatusBadge,
  getStatusLabelKey,
  getProvisioningBadge,
} from '../badges';
import { RequestActions } from './request-actions.component';

interface RequestTableProps {
  requests: ResourceRequest[];
  retryingId: string | null;
  onReview: (id: string, status: 'approved' | 'rejected') => void;
  onCancel: (id: string) => void;
  onRetryProvisioning: (request: ResourceRequest) => void;
  onComplete: (request: ResourceRequest) => void;
  onViewRuns: (request: ResourceRequest) => void;
}

export function RequestTable(props: RequestTableProps) {
  const { requests, retryingId, onReview, onCancel, onRetryProvisioning, onComplete, onViewRuns } =
    props;
  const t = useTranslations('resourceRequests');
  const tc = useTranslations('common');
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<ResourceRequest>[]>(
    () => [
      {
        id: 'request',
        header: t('request'),
        accessorFn: (row) => row.createdAt,
        cell: ({ row }) => {
          const request = row.original;
          return (
            <>
              <div className="font-medium">{request.title}</div>
              <div className="text-xs text-muted-foreground">
                {request.requester?.name || request.requester?.email || '-'} ·{' '}
                {new Date(request.createdAt).toLocaleString()}
              </div>
            </>
          );
        },
      },
      {
        id: 'resourceType',
        header: t('resourceType'),
        accessorFn: (row) => row.resourceType?.name || '',
        cell: ({ row }) => {
          const request = row.original;
          return (
            <>
              <div>{request.resourceType?.name || '-'}</div>
              <code className="text-xs text-muted-foreground">{request.resourceType?.key}</code>
              {request.resourceType?.provisioningMode ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {t('deliveryMode', { mode: request.resourceType.provisioningMode })}
                </div>
              ) : null}
            </>
          );
        },
      },
      {
        id: 'scope',
        header: t('projectEnvironment'),
        cell: ({ row }) => {
          const request = row.original;
          return (
            <>
              <div>{request.project?.name || t('noProject')}</div>
              <div className="text-xs text-muted-foreground">
                {request.environment || t('noEnvironment')}
              </div>
            </>
          );
        },
      },
      {
        id: 'status',
        header: tc('status'),
        accessorFn: (row) => row.status,
        cell: ({ row }) => {
          const request = row.original;
          return (
            <div className="space-y-1">
              {getStatusBadge(request.status, t(getStatusLabelKey(request.status)))}
              {getProvisioningBadge(request.result?.provisioning)}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: tc('actions'),
        cell: ({ row }) => (
          <RequestActions
            request={row.original}
            retryingId={retryingId}
            onReview={onReview}
            onCancel={onCancel}
            onRetryProvisioning={onRetryProvisioning}
            onComplete={onComplete}
            onViewRuns={onViewRuns}
          />
        ),
      },
    ],
    [retryingId, onReview, onCancel, onRetryProvisioning, onComplete, onViewRuns, t, tc],
  );

  const table = useReactTable({
    data: requests,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[860px]">
        <thead className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const isLast = header.column.id === 'actions';
                return (
                  <th
                    key={header.id}
                    className={`px-4 py-3 text-sm font-medium ${isLast ? 'text-right' : 'text-left'}`}
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={`flex items-center gap-1 ${isLast ? 'ml-auto justify-end' : ''}`}
                        disabled={!canSort}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort ? (
                          <span className="text-xs text-muted-foreground">
                            {{ asc: '▲', desc: '▼' }[header.column.getIsSorted() as string] || '↕'}
                          </span>
                        ) : null}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/30">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`px-4 py-3 ${cell.column.id === 'actions' ? 'text-right' : ''}`}
                >
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
