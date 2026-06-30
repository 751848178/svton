/** 资源连接与查询面板。 */
'use client';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useResourceControl } from '../hooks/use-resource-control';
type RCHook = ReturnType<typeof useResourceControl>;

export function ConnectionQueryPanel({ rc }: { rc: RCHook }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="overflow-hidden rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">连接运行</h2>
        </div>
        {rc.connectionRuns.length === 0 ? (
          <EmptyState text="暂无连接运行" />
        ) : (
          <div className="divide-y">
            {rc.connectionRuns.slice(0, 10).map((run) => (
              <div
                key={run.id}
                className="px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{run.resource?.name || 'resource'}</span>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">查询运行</h2>
        </div>
        {rc.queryRuns.length === 0 ? (
          <EmptyState text="暂无查询运行" />
        ) : (
          <div className="divide-y">
            {rc.queryRuns.slice(0, 10).map((run) => (
              <div
                key={run.id}
                className="px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{run.resource?.name || 'resource'}</span>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
