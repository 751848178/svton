/**
 * 日志浏览器工具栏。
 *
 * 单一职责：把 explorer 的所有过滤控制集中到一处 ——
 * 来源(流)选择、文本搜索(→ q)、级别、时间范围、Live 实时开关。
 * 搜索输入绑定 activeQuery，由 use-logs 防抖触发条目/统计重查。
 */
'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Input, Select } from '@svton/ui';
import type { useLogs } from '../hooks/use-logs';

type LogsHook = ReturnType<typeof useLogs>;

const LEVEL_OPTIONS = [
  { value: 'all', key: 'all' },
  { value: 'trace', key: 'trace' },
  { value: 'debug', key: 'debug' },
  { value: 'info', key: 'info' },
  { value: 'warn', key: 'warn' },
  { value: 'error', key: 'error' },
  { value: 'fatal', key: 'fatal' },
];

const TIME_RANGE_OPTIONS: Array<{ value: number; key: string }> = [
  { value: 5, key: 'last5m' },
  { value: 15, key: 'last15m' },
  { value: 60, key: 'last1h' },
  { value: 360, key: 'last6h' },
  { value: 1440, key: 'last24h' },
];

export function LogsToolbar({ logs }: { logs: LogsHook }) {
  const tl = useTranslations('logs');
  const s = logs.s;
  const t = logs.t;

  const handleToggleLive = usePersistFn(() => {
    const next = s.viewerMode === 'live' ? 'history' : 'live';
    s.setViewerMode(next);
    // 进入 live 时开启流式；切回历史时关闭，避免无谓 SSE。
    t.setTailStreaming(next === 'live');
  });

  const liveOn = s.viewerMode === 'live';

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={s.selectedStreamId}
          onChange={(e) => s.setSelectedStreamId(e.target.value)}
          className="min-w-48 max-w-64"
          aria-label={tl('logStreams')}
        >
          <option value="">{tl('allStreams')}</option>
          {s.streams.map((stream) => (
            <option key={stream.id} value={stream.id}>
              {stream.name} · {stream.sourceType}
            </option>
          ))}
        </Select>

        <Input
          value={s.activeQuery}
          onChange={(e) => s.setActiveQuery(e.target.value)}
          placeholder={tl('searchPlaceholder')}
          className="min-w-64 flex-1"
          aria-label={tl('search')}
        />

        <Select
          value={s.activeLevel}
          onChange={(e) => s.setActiveLevel(e.target.value as never)}
          className="w-28"
          aria-label={tl('colLevel')}
        >
          {LEVEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {tl(opt.key as never)}
            </option>
          ))}
        </Select>

        <Select
          value={String(s.timeRangeMinutes)}
          onChange={(e) => s.setTimeRangeMinutes(Number(e.target.value) || 60)}
          className="w-32"
          aria-label={tl('timeRange')}
        >
          {TIME_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {tl(opt.key as never)}
            </option>
          ))}
        </Select>

        <button
          onClick={handleToggleLive}
          className={`min-h-11 rounded-md px-4 py-2 text-sm font-medium ${
            liveOn
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
          aria-pressed={liveOn}
        >
          <span className="flex items-center gap-2">
            {liveOn && <span className="h-2 w-2 animate-pulse rounded-full bg-current" />}
            {liveOn ? tl('pauseTail') : tl('liveTail')}
          </span>
        </button>
      </div>
    </div>
  );
}
