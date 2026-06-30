/** 实时 Tail 面板 - SSE 流控制 + 条目展示 + 会话管理。 */
'use client';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { ErrorBanner, StatusTag } from '@/components/ui';
import type { useLogs } from '../hooks/use-logs';
import { levelClasses } from '../constants';
type LogsHook = ReturnType<typeof useLogs>;

export function TailPanel({ logs }: { logs: LogsHook }) {
  const s = logs.s;
  const t = logs.t;
  const handleRefresh = usePersistFn(() => logs.refreshTailEntries(true));
  const handleToggleStream = usePersistFn(() => t.setTailStreaming(!t.tailStreaming));
  if (!logs.selectedStream) return null;

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">实时 Tail</h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={t.tailAutoRefresh}
              onChange={(e) => t.setTailAutoRefresh(e.target.checked)}
            />
            自动刷新
          </label>
          <button
            onClick={handleRefresh}
            disabled={t.tailLoading}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {t.tailLoading ? '刷新中...' : '刷新'}
          </button>
          <button
            onClick={handleToggleStream}
            className={`rounded-md px-3 py-1.5 text-sm ${t.tailStreaming ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}
          >
            {t.tailStreaming ? '停止流式' : '开始流式'}
          </button>
        </div>
      </div>
      {t.tailStreamConnecting && <div className="text-sm text-muted-foreground">连接中...</div>}
      {t.tailError && (
        <ErrorBanner
          message={t.tailError}
          variant="inline"
        />
      )}
      {t.tailStreamReconnects > 0 && (
        <div className="text-xs text-yellow-700">重连次数：{t.tailStreamReconnects}</div>
      )}
      <div className="max-h-80 overflow-auto rounded-md border">
        {t.tailEntries.length === 0 ? (
          <EmptyState text="暂无 Tail 条目" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">级别</th>
                <th className="px-3 py-2 font-medium">内容</th>
                <th className="px-3 py-2 font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {t.tailEntries.slice(-100).map((entry) => (
                <tr key={entry.id}>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${levelClasses[entry.level] || 'bg-muted'}`}
                    >
                      {entry.level}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.message}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString('zh-CN', {
                      hour12: false,
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {t.tailStreamSessionId && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <StatusTag
            status="active"
            label={`会话 ${t.tailStreamSessionId.slice(0, 8)}`}
          />
          {t.tailStreamExpiresAt && (
            <span>
              到期：{new Date(t.tailStreamExpiresAt).toLocaleString('zh-CN', { hour12: false })}
            </span>
          )}
          <button
            onClick={() => logs.closeStreamSession(t.tailStreamSessionId!)}
            disabled={t.closingStreamSessionId === t.tailStreamSessionId}
            className="text-destructive hover:underline disabled:opacity-50"
          >
            {t.closingStreamSessionId === t.tailStreamSessionId ? '关闭中...' : '关闭会话'}
          </button>
        </div>
      )}
    </div>
  );
}
