/** 采集运行与保留运行记录面板。 */
'use client';
import { usePersistFn } from '@svton/hooks';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { runStatusClasses } from '../constants';
import type { useLogs } from '../hooks/use-logs';
type LogsHook = ReturnType<typeof useLogs>;

export function LogsRunsSection({ logs }: { logs: LogsHook }) {
  const s = logs.s;
  const t = logs.t;
  const handleCollect = usePersistFn(() => logs.collectSelectedStream());
  const handleCleanupDry = usePersistFn(() => logs.cleanupSelectedRetention(true));
  const handleCleanupLive = usePersistFn(() => logs.cleanupSelectedRetention(false));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">采集运行</h2>
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={t.queueLogCollections}
                onChange={(e) => t.setQueueLogCollections(e.target.checked)}
              />
              入队
            </label>
            <button
              onClick={handleCollect}
              disabled={s.collecting}
              className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              {s.collecting ? '生成中...' : '生成采集'}
            </button>
          </div>
        </div>
        {s.collectionRuns.length === 0 ? (
          <EmptyState text="暂无采集运行" />
        ) : (
          <div className="space-y-2">
            {s.collectionRuns.slice(0, 10).map((run) => (
              <div
                key={run.id}
                className="rounded-md border px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{run.sourceType}</span>
                  <StatusTag status={run.status} />
                </div>
                <div className="mt-1 text-muted-foreground">
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
                {run.error && <div className="mt-1 text-red-600">{run.error}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">保留清理</h2>
          <div className="flex gap-2">
            <button
              onClick={handleCleanupDry}
              disabled={t.cleaningRetention === 'dry-run'}
              className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              {t.cleaningRetention === 'dry-run' ? '执行中...' : 'Dry-run'}
            </button>
            <button
              onClick={handleCleanupLive}
              disabled={t.cleaningRetention === 'live'}
              className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              {t.cleaningRetention === 'live' ? '执行中...' : 'Live'}
            </button>
          </div>
        </div>
        {s.retentionRuns.length === 0 ? (
          <EmptyState text="暂无保留运行" />
        ) : (
          <div className="space-y-2">
            {s.retentionRuns.slice(0, 10).map((run) => (
              <div
                key={run.id}
                className="rounded-md border px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{run.dryRun ? 'dry-run' : 'live'}</span>
                  <StatusTag status={run.status} />
                </div>
                <div className="mt-1 text-muted-foreground">
                  删除 {run.deletedEntryCount} 条 · 匹配 {run.matchedEntryCount} 条
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
