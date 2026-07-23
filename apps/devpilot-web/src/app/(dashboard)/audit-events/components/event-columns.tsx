/**
 * 审计事件表格列定义
 *
 * 单一职责：声明 @tanstack/react-table 的 ColumnDef（含时间/动作/目标/范围/执行人/状态）。
 * 从 event-table.tsx 抽出，避免宿主文件超 200 行。需要 useTranslations 故以 hook 形式提供。
 */

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { StatusTag } from '@/components/ui';
import type { AuditEvent } from '../types';
import { categoryLabels, statusLabels, riskLabels, actionLabels } from '../constants';
import {
  formatTarget,
  getTargetHref,
  formatRunRef,
  formatDateTime,
  humanizeAction,
} from '../utils';

/** 返回审计事件表格列定义（label 随当前 locale 变化）。 */
export function useEventColumns(): ColumnDef<AuditEvent>[] {
  const t = useTranslations('auditEvents');
  return useMemo<ColumnDef<AuditEvent>[]>(
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
              <div className="mt-1 text-xs text-muted-foreground">
                {humanizeAction(event.action, actionLabels)}
              </div>
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
          const href = getTargetHref(event);
          const targetName = formatTarget(event);
          return (
            <>
              {href ? (
                <Link href={href} className="font-medium text-primary hover:underline">
                  {targetName}
                </Link>
              ) : (
                <div className="font-medium">{targetName}</div>
              )}
              {event.targetType ? (
                <div className="mt-1 text-xs text-muted-foreground">{event.targetType}</div>
              ) : null}
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
        header: t('status'),
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
}
