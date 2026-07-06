/**
 * 代理配置表格（@tanstack/react-table）
 *
 * 单一职责：渲染代理配置列表 + 同步/详情/删除操作。
 * 头部采用 headless table 提供按域名/创建时间排序。
 */
'use client';

import { useMemo, useState } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { StatusTag } from '@/components/ui';
import type { ProxyConfig } from '../types';

interface ProxyConfigTableProps {
  configs: ProxyConfig[];
  syncingId: string | null;
  onSync: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProxyConfigTable({ configs, syncingId, onSync, onDelete }: ProxyConfigTableProps) {
  const t = useTranslations('proxyConfigs');
  const tc = useTranslations('common');
  const [sorting, setSorting] = useState<SortingState>([]);

  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      active: t('statusActive'),
      error: t('statusError'),
      pending: t('statusPending'),
    }),
    [t],
  );

  const columns = useMemo<ColumnDef<ProxyConfig>[]>(
    () => [
      {
        id: 'name',
        header: tc('name'),
        accessorFn: (row) => row.name,
        cell: ({ row }) => {
          const config = row.original;
          return (
            <>
              <div className="font-medium">{config.name}</div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                {config.ssl.enabled ? <span>🔒 SSL</span> : null}
                {config.websocket ? <span>🔌 WS</span> : null}
              </div>
            </>
          );
        },
      },
      {
        id: 'domain',
        header: t('domain'),
        accessorFn: (row) => row.domain,
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.domain}</span>
        ),
      },
      {
        id: 'upstreams',
        header: t('upstreams'),
        cell: ({ row }) =>
          row.original.upstreams.map((u, i) => (
            <div key={i} className="font-mono text-xs">
              {u.host}:{u.port || 80}
            </div>
          )),
      },
      {
        id: 'server',
        header: t('server'),
        cell: ({ row }) => {
          const server = row.original.server;
          return server ? (
            <span className="text-sm text-muted-foreground">{server.name}</span>
          ) : (
            <span className="text-sm text-muted-foreground/50">{t('notAssociated')}</span>
          );
        },
      },
      {
        id: 'status',
        header: tc('status'),
        accessorFn: (row) => row.status,
        cell: ({ row }) => {
          const config = row.original;
          return (
            <StatusTag status={config.status} label={statusLabels[config.status] || config.status} />
          );
        },
      },
      {
        id: 'actions',
        header: tc('actions'),
        cell: ({ row }) => (
          <ProxyActions
            config={row.original}
            syncing={syncingId === row.original.id}
            onSync={onSync}
            onDelete={onDelete}
          />
        ),
      },
    ],
    [t, tc, statusLabels, syncingId, onSync, onDelete],
  );

  const table = useReactTable({
    data: configs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
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

function ProxyActions({
  config,
  syncing,
  onSync,
  onDelete,
}: {
  config: ProxyConfig;
  syncing: boolean;
  onSync: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations('proxyConfigs');
  const tc = useTranslations('common');
  const router = useRouter();
  const handleSync = usePersistFn(() => onSync(config.id));
  const handleDetail = usePersistFn(() => router.push(`/proxy-configs/${config.id}`));
  const handleDelete = usePersistFn(() => onDelete(config.id));

  return (
    <div className="flex justify-end gap-2">
      <button
        onClick={handleSync}
        disabled={syncing || !config.server}
        className="rounded border px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
      >
        {syncing ? t('syncing') : t('sync')}
      </button>
      <button
        onClick={handleDetail}
        className="rounded border px-2 py-1 text-xs font-medium hover:bg-accent"
      >
        {t('detail')}
      </button>
      <button
        onClick={handleDelete}
        className="rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
      >
        {tc('delete')}
      </button>
    </div>
  );
}
