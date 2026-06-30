/** 日志条目面板 - 流列表 + 条目展示 + 追加输入。 */
'use client';
import { usePersistFn } from '@svton/hooks';
import { EmptyState, Tag } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useLogs } from '../hooks/use-logs';
import { levelClasses } from '../constants';
type LogsHook = ReturnType<typeof useLogs>;

export function LogEntriesSection({ logs }: { logs: LogsHook }) {
  const s = logs.s;
  const handleAppend = usePersistFn(() => logs.appendEntry());
  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="space-y-4">
        <h2 className="font-medium">日志流</h2>
        {s.streams.length === 0 ? (
          <EmptyState text="暂无日志流" />
        ) : (
          <div className="space-y-2">
            {s.streams.map((stream) => (
              <button
                key={stream.id}
                onClick={() => s.setSelectedStreamId(stream.id)}
                className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${s.selectedStreamId === stream.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{stream.name}</span>
                  <StatusTag status={stream.status} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{stream.sourceType}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">{logs.selectedStream?.name || '日志条目'}</h2>
          {logs.selectedStream ? <Tag color="default">{logs.selectedStream.sourceType}</Tag> : null}
        </div>
        {logs.selectedStream && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <select
                value={s.entryLevel}
                onChange={(e) => s.setEntryLevel(e.target.value as never)}
                className="rounded-md border bg-background px-3 py-1.5 text-sm"
              >
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
              <input
                value={s.entryMessage}
                onChange={(e) => s.setEntryMessage(e.target.value)}
                placeholder="输入日志内容"
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
              />
              <button
                onClick={handleAppend}
                disabled={s.appending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {s.appending ? '追加中...' : '追加'}
              </button>
            </div>
          </div>
        )}
        <div className="max-h-96 overflow-auto rounded-md border">
          {s.entries.length === 0 ? (
            <EmptyState text="暂无日志条目" />
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
                {s.entries.slice(0, 50).map((entry) => (
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
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
