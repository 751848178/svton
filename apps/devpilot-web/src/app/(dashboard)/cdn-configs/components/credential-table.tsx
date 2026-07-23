/**
 * 凭证列表表格（@tanstack/react-table）
 *
 * 单一职责：渲染 CDN 凭证列表 + 删除操作；按名称/类型/创建时间排序。
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
import { usePersistFn } from '@svton/hooks';
import { formatDateTime } from '@/lib/format-date';
import { Button } from '@/components/ui';
import type { TeamCredential } from '../types';
import { getCredentialTypeLabel } from '../utils';
import { SortIcon } from './sort-icon';

interface CredentialTableProps {
  credentials: TeamCredential[];
  onDelete: (id: string) => void;
}

export function CredentialTable({ credentials, onDelete }: CredentialTableProps) {
  const tc = useTranslations('common');
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<TeamCredential>[]>(
    () => [
      {
        id: 'name',
        header: tc('name'),
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: 'type',
        header: tc('type'),
        accessorFn: (row) => getCredentialTypeLabel(row.type),
        cell: ({ row }) => (
          <span className="text-sm">{getCredentialTypeLabel(row.original.type)}</span>
        ),
      },
      {
        id: 'createdAt',
        header: tc('createdAt'),
        accessorFn: (row) => row.createdAt,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: tc('actions'),
        cell: ({ row }) => <DeleteAction id={row.original.id} onDelete={onDelete} />,
      },
    ],
    [onDelete, tc],
  );

  const table = useReactTable({
    data: credentials,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border">
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
                          <SortIcon state={header.column.getIsSorted() as false | 'asc' | 'desc'} />
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

function DeleteAction({
  id,
  onDelete,
}: {
  id: string;
  onDelete: (id: string) => void;
}) {
  const tc = useTranslations('common');
  const handleDelete = usePersistFn(() => onDelete(id));
  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
    >
      {tc('delete')}
    </Button>
  );
}

