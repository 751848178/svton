/** 日志条目面板 - 流列表 + 条目展示 + 追加输入。 */
'use client';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { EmptyState, Tag } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useLogs } from '../hooks/use-logs';
import { formatDateTimeMinute } from '@/lib/format-date';
type LogsHook = ReturnType<typeof useLogs>;

export function LogEntriesSection({ logs }: { logs: LogsHook }) {
  const t = useTranslations('logs');
  const s = logs.s;
  const handleAppend = usePersistFn(() => logs.appendEntry());
  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="space-y-4">
        <h2 className="font-medium">{t('logStreams')}</h2>
        {s.streams.length === 0 ? (
          <EmptyState text={t('noStreams')} />
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
          <h2 className="font-medium">{logs.selectedStream?.name || t('logEntries')}</h2>
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
                placeholder={t('entryMessagePlaceholder')}
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
              />
              <button
                onClick={handleAppend}
                disabled={s.appending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {s.appending ? t('appending') : t('append')}
              </button>
            </div>
          </div>
        )}
        <div className="max-h-96 overflow-auto rounded-md border">
          {s.entries.length === 0 ? (
            <EmptyState text={t('noEntries')} />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('colLevel')}</th>
                  <th className="px-3 py-2 font-medium">{t('colContent')}</th>
                  <th className="px-3 py-2 font-medium">{t('colTime')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {s.entries.slice(0, 50).map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-2">
                      <StatusTag status={entry.level} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.message}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDateTimeMinute(entry.timestamp)}
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
