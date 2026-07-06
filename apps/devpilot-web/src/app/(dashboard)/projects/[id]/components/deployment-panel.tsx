/** 项目部署运行面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

export function DeploymentPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  if (detail.deploymentRuns.length === 0) return <EmptyState text={t('noDeploymentRuns')} />;
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 font-semibold">{t('deploymentRuns')}</h2>
      <div className="space-y-2">
        {detail.deploymentRuns.slice(0, 10).map((run) => (
          <div
            key={run.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium">{run.source}</span>
              <span className="ml-2 text-xs text-muted-foreground">{run.branch || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusTag status={run.status} />
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
