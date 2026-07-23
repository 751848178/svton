/** 实时 Tail 面板 - SSE 流控制 + 条目展示 + 会话管理。 */
'use client';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { ErrorBanner, StatusTag } from '@/components/ui';
import type { useLogs } from '../hooks/use-logs';
import { formatDateTime } from '@/lib/format-date';
type LogsHook = ReturnType<typeof useLogs>;

export function TailPanel({ logs }: { logs: LogsHook }) {
  const tl = useTranslations('logs');
  const s = logs.s;
  const t = logs.t;
  const handleRefresh = usePersistFn(() => logs.refreshTailEntries(true));
  const handleToggleStream = usePersistFn(() => t.setTailStreaming(!t.tailStreaming));
  if (!logs.selectedStream) return null;

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">{tl('tail')}</h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={t.tailAutoRefresh}
              onChange={(e) => t.setTailAutoRefresh(e.target.checked)}
            />
            {tl('autoRefresh')}
          </label>
          <button
            onClick={handleRefresh}
            disabled={t.tailLoading}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {t.tailLoading ? tl('refreshing') : tl('refresh')}
          </button>
          <button
            onClick={handleToggleStream}
            className={`rounded-md px-3 py-1.5 text-sm ${t.tailStreaming ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}
          >
            {t.tailStreaming ? tl('stopStream') : tl('startStream')}
          </button>
        </div>
      </div>
      {t.tailStreamConnecting && <div className="text-sm text-muted-foreground">{tl('connecting')}</div>}
      {t.tailError && (
        <ErrorBanner
          message={t.tailError}
          variant="inline"
        />
      )}
      {t.tailStreamReconnects > 0 && (
        <div className="text-xs text-warning">{tl('reconnectCount', { count: t.tailStreamReconnects })}</div>
      )}
      <div className="max-h-80 overflow-auto rounded-md border">
        {t.tailEntries.length === 0 ? (
          <EmptyState text={tl('noTailEntries')} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{tl('colLevel')}</th>
                <th className="px-3 py-2 font-medium">{tl('colContent')}</th>
                <th className="px-3 py-2 font-medium">{tl('colTime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {t.tailEntries.slice(-100).map((entry) => (
                <tr key={entry.id}>
                  <td className="px-3 py-2">
                    <StatusTag status={entry.level} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.message}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDateTime(entry.timestamp)}
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
            label={tl('sessionLabel', { id: t.tailStreamSessionId.slice(0, 8) })}
          />
          {t.tailStreamExpiresAt && (
            <span>
              {tl('expiresAt', { time: formatDateTime(t.tailStreamExpiresAt) })}
            </span>
          )}
          <button
            onClick={() => logs.closeStreamSession(t.tailStreamSessionId!)}
            disabled={t.closingStreamSessionId === t.tailStreamSessionId}
            className="text-destructive hover:underline disabled:opacity-50"
          >
            {t.closingStreamSessionId === t.tailStreamSessionId ? tl('closing') : tl('closeSession')}
          </button>
        </div>
      )}
    </div>
  );
}
