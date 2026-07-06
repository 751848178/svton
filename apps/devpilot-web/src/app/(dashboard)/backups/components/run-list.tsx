/**
 * 备份运行记录列表
 *
 * 单一职责：渲染最近的备份运行记录（最多 12 条）。
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { BackupRun } from '../types';
import { statusLabels } from '../constants';
import { formatResource, formatDate } from '../utils';

interface RunListProps {
  runs: BackupRun[];
}

export function RunList({ runs }: RunListProps) {
  const t = useTranslations('backups');
  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-medium">{t('recentRuns')}</h2>
      </div>
      <div className="divide-y">
        {runs.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">{t('noRuns')}</div>
        ) : (
          runs.slice(0, 12).map((run) => (
            <RunRow
              key={run.id}
              run={run}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RunRow({ run }: { run: BackupRun }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {run.plan?.name || run.resource?.name || run.id}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {run.executorKey} · {run.adapterKey} · {run.dryRun ? 'dry-run' : 'live'}
          </div>
        </div>
        <StatusTag
          status={run.status}
          label={statusLabels[run.status] || run.status}
        />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {formatResource(run.resource)} · {formatDate(run.startedAt)}
      </div>
      {run.serverExecutionJob ? (
        <div className="mt-1 text-xs">
          <Link
            href="/execution-governance"
            className="text-primary hover:underline"
          >
            Job {run.serverExecutionJob.id.slice(0, 8)} ·{' '}
            {statusLabels[run.serverExecutionJob.status] || run.serverExecutionJob.status}
          </Link>
        </div>
      ) : null}
      {run.error ? (
        <div className="mt-2 rounded-md bg-yellow-50 px-2 py-1 text-xs text-yellow-800">
          {run.error}
        </div>
      ) : null}
    </div>
  );
}
