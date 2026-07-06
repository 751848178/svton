/**
 * 日志 Tail 轮询副作用
 *
 * 单一职责：在自动刷新开启时按 cursor 轮询 Tail entries。
 */

import { useEffect } from 'react';
import { usePersistFn } from '@svton/hooks';
import type { LogsState } from './use-logs-state';
import type { LogsTailState } from './use-logs-tail-state';
import type { LogEntry, LogTailResponse } from '../types-stream';

interface UseLogsTailPollingEffectsArgs {
  loadTailEntries: (cursor?: string | null) => Promise<LogTailResponse>;
  mergeTimeline: (current: LogEntry[], incoming: LogEntry[]) => LogEntry[];
  selectedStreamId: string;
  t: LogsTailState;
  tailCursorRef: LogsState['tailCursorRef'];
}

export function useLogsTailPollingEffects(args: UseLogsTailPollingEffectsArgs) {
  const { loadTailEntries, mergeTimeline, selectedStreamId, t, tailCursorRef } = args;
  const { tailAutoRefresh, setTailCursor, setTailEntries, setTailError } = t;

  const startTailPolling = usePersistFn(() => {
    let cancelled = false;
    let cursor = tailCursorRef.current;
    const poll = async () => {
      try {
        const res = await loadTailEntries(cursor);
        if (cancelled) return;
        cursor = res.cursor || cursor;
        setTailCursor(res.cursor || null);
        setTailEntries((c: LogEntry[]) => mergeTimeline(c, res.entries));
        setTailError('');
      } catch (err) {
        if (!cancelled) {
          setTailError(err instanceof Error ? err.message : 'Tail 刷新失败');
        }
      }
    };
    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  });

  useEffect(() => {
    if (!tailAutoRefresh || !selectedStreamId) return;
    return startTailPolling();
  }, [selectedStreamId, startTailPolling, tailAutoRefresh]);
}
