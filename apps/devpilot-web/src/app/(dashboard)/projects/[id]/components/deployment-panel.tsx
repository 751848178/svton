/** 项目部署运行面板。 */
'use client';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

export function DeploymentPanel({ detail }: { detail: DetailHook }) {
  if (detail.deploymentRuns.length === 0) return <EmptyState text="暂无部署运行" />;
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 font-semibold">部署运行</h2>
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
                {new Date(run.startedAt).toLocaleString('zh-CN', {
                  hour12: false,
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
