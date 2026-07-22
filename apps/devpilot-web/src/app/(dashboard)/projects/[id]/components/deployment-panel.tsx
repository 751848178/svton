/** 项目部署运行面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

/** 部署运行状态值 → 本地化标签 key（避免 StatusTag 回退显示英文原值）。 */
function getRunStatusLabelKey(status: string): string {
  const s = status.toLowerCase();
  if (s === 'queued') return 'runStatusQueued';
  if (s === 'running') return 'runStatusRunning';
  if (s === 'completed') return 'runStatusCompleted';
  if (s === 'failed') return 'runStatusFailed';
  if (s === 'blocked') return 'runStatusBlocked';
  if (s === 'succeeded' || s === 'success') return 'runStatusSucceeded';
  if (s === 'pending') return 'runStatusPending';
  if (s === 'cancelled' || s === 'canceled') return 'runStatusCancelled';
  return 'runStatusUnknown';
}

export function DeploymentPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  if (detail.deploymentRuns.length === 0) return <EmptyState text={t('noDeploymentRuns')} />;
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="font-semibold">{t('deploymentRuns')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('deploymentPanelDescription')}</p>
      </div>
      <div className="space-y-2">
        {detail.deploymentRuns.slice(0, 10).map((run) => (
          <div
            key={run.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <span className="font-medium">
                {t('sourceLabel')}: {run.source}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {t('branchLabel')}: {run.branch || '-'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusTag status={run.status} label={t(getRunStatusLabelKey(run.status))} />
              <span className="text-xs text-muted-foreground">
                {formatDateTimeMinute(run.startedAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
