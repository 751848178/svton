/**
 * 统一日志查看器。
 *
 * 单一职责：一张表渲染「历史条目」或「实时 Tail 条目」，由 viewerMode 决定数据源。
 * 同一行渲染器服务两种模式 —— Live 模式取 t.tailEntries（SSE 实时流），
 * 历史模式取 s.entries（按过滤器查询）。顶部为按当前过滤范围计算的上下文统计条。
 */
'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useLogs } from '../hooks/use-logs';
import type { LogEntry } from '../types-stream';
import { formatDateTime } from '@/lib/format-date';

type LogsHook = ReturnType<typeof useLogs>;

export function LogsViewer({ logs }: { logs: LogsHook }) {
  const tl = useTranslations('logs');
  const s = logs.s;
  const live = s.viewerMode === 'live';
  const rows: LogEntry[] = live ? logs.t.tailEntries : s.entries;
  const visible = live ? rows.slice(-100) : rows.slice(0, s.entryPageLimit);
  const loading = live ? logs.t.tailLoading : s.entriesLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border">
      <StatsStrip logs={logs} />
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="font-medium">
          {live ? tl('liveTail') : tl('logEntries')}
          {logs.selectedStream ? ` · ${logs.selectedStream.name}` : ''}
        </h2>
        {live && logs.t.tailStreamConnecting ? (
          <span className="text-xs text-muted-foreground">{tl('connecting')}</span>
        ) : null}
      </div>
      <div className="relative max-h-[60vh] flex-1 overflow-auto">
        {rows.length === 0 ? (
          <EmptyState text={loading ? tl('refreshing') : live ? tl('noTailEntries') : tl('noEntries')} />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 text-left">
              <tr>
                <th className="w-24 px-3 py-2 font-medium">{tl('colLevel')}</th>
                <th className="px-3 py-2 font-medium">{tl('colContent')}</th>
                <th className="w-40 px-3 py-2 font-medium">{tl('colTime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((entry) => (
                <tr key={entry.id} className="hover:bg-accent/50">
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
      {!live && rows.length > s.entryPageLimit ? <LoadMore logs={logs} /> : null}
    </div>
  );
}

/** 按当前过滤范围（stream/level/timeRange）计算的上下文统计条，取代全局横幅。 */
function StatsStrip({ logs }: { logs: LogsHook }) {
  const tl = useTranslations('logs');
  const stats = logs.s.logStats;
  if (!stats) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span>
        <strong className="text-foreground">{stats.total.toLocaleString()}</strong>{' '}
        {tl('statsEntries')}
      </span>
      <span>
        <strong className="text-warning">{stats.warningCount}</strong> {tl('levelWarning').toLowerCase()}
      </span>
      <span>
        <strong className="text-destructive">{stats.errorCount}</strong> {tl('errorLogs').toLowerCase()}
      </span>
      <span>
        {tl('timeRange')}: {logs.s.timeRangeMinutes < 60
          ? tl('minutesShort', { n: logs.s.timeRangeMinutes })
          : tl('hoursShort', { n: Math.round(logs.s.timeRangeMinutes / 60) })}
      </span>
    </div>
  );
}

function LoadMore({ logs }: { logs: LogsHook }) {
  const tl = useTranslations('logs');
  const handle = usePersistFn(() => logs.s.setEntryPageLimit((cur: number) => cur + 50));
  return (
    <div className="border-t p-2 text-center">
      <button
        onClick={handle}
        className="rounded-md border px-4 py-1.5 text-sm hover:bg-accent"
      >
        {tl('loadMore')}
      </button>
    </div>
  );
}
