/**
 * 备份计划卡片
 *
 * 单一职责：渲染单个备份计划 + 运行/启停操作。
 */

import { usePersistFn } from '@svton/hooks';
import { StatusTag } from '@/components/ui';
import type { BackupPlan } from '../types';
import { backupTypeLabels, statusLabels } from '../constants';
import { formatResource, formatDate, canQueueBackupRun } from '../utils';

interface PlanCardProps {
  plan: BackupPlan;
  runningPlanId: string;
  updatingPlanId: string;
  queueBackupRuns: boolean;
  onRun: (plan: BackupPlan) => void;
  onToggleStatus: (plan: BackupPlan) => void;
}

export function PlanCard(props: PlanCardProps) {
  const { plan, runningPlanId, updatingPlanId, queueBackupRuns, onRun, onToggleStatus } = props;
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
                label={`最近：${statusLabels[plan.lastStatus] || plan.lastStatus}`}
              />
            ) : null}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {backupTypeLabels[plan.backupType] || plan.backupType} · 保留 {plan.retentionDays} 天 ·{' '}
            {plan.destinationType}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            资源：{formatResource(plan.resource)} · 服务器：{plan.server?.name || '未绑定'}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            项目：{plan.project?.name || '未关联'} · 环境：
            {plan.environment?.name || plan.environment?.key || '未关联'} · 最近运行：
            {plan.lastRunAt ? formatDate(plan.lastRunAt) : '-'}
          </div>
          {plan.runs && plan.runs.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {plan.runs.map((run) => (
                <span
                  key={run.id}
                  className="rounded-md bg-muted px-2 py-1"
                >
                  {statusLabels[run.status] || run.status} · {formatDate(run.startedAt)}
                  {run.serverExecutionJob ? ` · Job ${run.serverExecutionJob.id.slice(0, 8)}` : ''}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRun}
            disabled={Boolean(runningPlanId) || plan.status !== 'active'}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {isRunningThis
              ? queueThisRun
                ? '入队中...'
                : '生成中...'
              : queueThisRun
                ? '加入队列'
                : '生成计划'}
          </button>
          <button
            onClick={handleToggle}
            disabled={Boolean(updatingPlanId) || plan.status === 'archived'}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {updatingPlanId === plan.id ? '更新中...' : plan.status === 'active' ? '暂停' : '启用'}
          </button>
        </div>
      </div>
    </div>
  );
}
