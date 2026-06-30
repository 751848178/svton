/** 资源操作运行记录面板。 */
'use client';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useResourceControl } from '../hooks/use-resource-control';
type RCHook = ReturnType<typeof useResourceControl>;

export function ActionRunsPanel({ rc }: { rc: RCHook }) {
  if (rc.actionRuns.length === 0) return <EmptyState text="暂无操作运行记录" />;
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">操作运行</h2>
      </div>
      <div className="divide-y">
        {rc.actionRuns.slice(0, 20).map((run) => (
          <div
            key={run.id}
            className="px-4 py-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{run.action}</span>
              <StatusTag status={run.status} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(run.startedAt).toLocaleString('zh-CN', {
                hour12: false,
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {run.finishedAt
                ? ` → ${new Date(run.finishedAt).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </div>
            {run.error && <div className="mt-1 text-xs text-red-600">{run.error}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
