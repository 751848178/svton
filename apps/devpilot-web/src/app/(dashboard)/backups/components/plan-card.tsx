/**
 * 备份计划卡片
 *
 * 单一职责：渲染单个备份计划 + 运行/启停操作。
 */

'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { StatusTag } from '@/components/ui';
import type { BackupPlan, BackupPlanRun, BackupRestoreTarget } from '../types';
import { backupTypeLabels, statusLabels } from '../constants';
import { formatResource, formatDate, canQueueBackupRun, canRestoreBackupRun } from '../utils';

interface PlanCardProps {
  plan: BackupPlan;
  runningPlanId: string;
  updatingPlanId: string;
  queueBackupRuns: boolean;
  onRun: (plan: BackupPlan) => void;
  onToggleStatus: (plan: BackupPlan) => void;
  onRestore: (target: BackupRestoreTarget) => void;
}

export function PlanCard(props: PlanCardProps) {
  const { plan, runningPlanId, updatingPlanId, queueBackupRuns, onRun, onToggleStatus, onRestore } =
    props;
  const t = useTranslations('backups');
  const queueThisRun = queueBackupRuns && canQueueBackupRun(plan);
  const isRunningThis = runningPlanId === plan.id;

  const handleRun = usePersistFn(() => onRun(plan));
  const handleToggle = usePersistFn(() => onToggleStatus(plan));

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{plan.name}</h3>
            <StatusTag
              status={plan.status}
              label={statusLabels[plan.status] || plan.status}
            />
            {plan.lastStatus ? (
              <StatusTag
                status={plan.lastStatus}
                label={t('recentPrefix', { value: statusLabels[plan.lastStatus] || plan.lastStatus })}
              />
            ) : null}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {backupTypeLabels[plan.backupType] || plan.backupType} · {t('retentionDaysSuffix', { days: plan.retentionDays })} ·{' '}
            {plan.destinationType}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {t('resourcePrefix', { value: formatResource(plan.resource) })} · {t('serverPrefix', { value: plan.server?.name || t('unbound') })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t('projectPrefix', { value: plan.project?.name || t('unassociated') })} · {t('envPrefix', { value: plan.environment?.name || plan.environment?.key || t('unassociated') })} · {t('lastRunPrefix', { value: plan.lastRunAt ? formatDate(plan.lastRunAt) : '-' })}
          </div>
          {plan.runs && plan.runs.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {plan.runs.map((run) => (
                <PlanRunChip
                  key={run.id}
                  run={run}
                  planName={plan.name}
                  onRestore={onRestore}
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRun}
            disabled={Boolean(runningPlanId) || plan.status !== 'active'}
            className="min-h-11 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {isRunningThis
              ? queueThisRun
                ? t('queuing')
                : t('generating')
              : queueThisRun
                ? t('joinQueue')
                : t('generatePlan')}
          </button>
          <button
            onClick={handleToggle}
            disabled={Boolean(updatingPlanId) || plan.status === 'archived'}
            className="min-h-11 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {updatingPlanId === plan.id ? t('updating') : plan.status === 'active' ? t('pause') : t('enable')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 单个备份运行 chip：状态 + 时间 +（completed/success 时）恢复入口。 */
function PlanRunChip({
  run,
  planName,
  onRestore,
}: {
  run: BackupPlanRun;
  planName: string;
  onRestore: (target: BackupRestoreTarget) => void;
}) {
  const t = useTranslations('backups');
  const handleRestore = usePersistFn(() => onRestore({ id: run.id, name: planName }));
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
      {statusLabels[run.status] || run.status} · {formatDate(run.startedAt)}
      {run.serverExecutionJob ? ` · Job ${run.serverExecutionJob.id.slice(0, 8)}` : ''}
      {canRestoreBackupRun(run.status) ? (
        <button
          onClick={handleRestore}
          className="text-primary hover:underline"
        >
          {t('restore')}
        </button>
      ) : null}
    </span>
  );
}
