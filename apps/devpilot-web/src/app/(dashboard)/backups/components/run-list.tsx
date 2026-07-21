/**
 * 备份运行记录列表
 *
 * 单一职责：渲染最近的备份运行记录（最多 12 条）。
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { BackupRestoreTarget, BackupRun } from '../types';
import { statusLabels } from '../constants';
import { formatResource, formatDate, canRestoreBackupRun } from '../utils';

interface RunListProps {
  runs: BackupRun[];
  onRestore: (target: BackupRestoreTarget) => void;
}

export function RunList({ runs, onRestore }: RunListProps) {
  const t = useTranslations('backups');
  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-medium">{t('recentRuns')}</h2>
      </div>
      <div className="divide-y">
        {runs.length === 0 ? (
          <EmptyState text={t('noRuns')} />
        ) : (
          runs.slice(0, 12).map((run) => (
            <RunRow
              key={run.id}
              run={run}
              onRestore={onRestore}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RunRow({
  run,
  onRestore,
}: {
  run: BackupRun;
  onRestore: (target: BackupRestoreTarget) => void;
}) {
  const t = useTranslations('backups');
  const runName = run.plan?.name || run.resource?.name || run.id;
  const handleRestore = usePersistFn(() => onRestore({ id: run.id, name: runName }));
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{runName}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {run.executorKey} · {run.adapterKey} · {run.dryRun ? t('dryRun') : t('live')}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canRestoreBackupRun(run.status) ? (
            <button
              onClick={handleRestore}
              className="min-h-9 rounded-md border px-3 py-1 text-sm text-primary hover:bg-accent"
            >
              {t('restore')}
            </button>
          ) : null}
          <StatusTag
            status={run.status}
            label={statusLabels[run.status] || run.status}
          />
        </div>
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
        <div className="mt-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {run.error}
        </div>
      ) : null}
    </div>
  );
}
