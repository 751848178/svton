/**
 * 日志 Tail 流式副作用
 *
 * 单一职责：同步 Tail refs，维护轮询与 SSE 实时流连接生命周期。
 */

import { useEffect } from 'react';
import { usePersistFn } from '@svton/hooks';
import { stream } from '@/lib/api-client/stream';
import type { LogsState } from './use-logs-state';
import type { LogsTailState } from './use-logs-tail-state';
import type { LogEntry, LogTailResponse } from '../types-stream';
import { getStreamReconnectDelayMs, readSseStream } from '../utils-sse';

const streamSessionMaxMs = 5 * 60 * 1000;

interface UseLogsTailStreamEffectsArgs {
  loadTailEntries: (cursor?: string | null) => Promise<LogTailResponse>;
  mergeTimeline: (current: LogEntry[], incoming: LogEntry[]) => LogEntry[];
  refreshStreamSessions: () => Promise<void>;
  selectedStreamId: string;
  t: LogsTailState;
  tailCursorRef: LogsState['tailCursorRef'];
  tailStreamSessionIdRef: LogsState['tailStreamSessionIdRef'];
}

export function useLogsTailStreamEffects(args: UseLogsTailStreamEffectsArgs) {
  const {
    loadTailEntries,
    mergeTimeline,
    refreshStreamSessions,
    selectedStreamId,
    t,
    tailCursorRef,
    tailStreamSessionIdRef,
  } = args;
  const {
    tailAutoRefresh,
    tailCursor,
    tailStreaming,
    tailStreamSessionId,
    setTailCursor,
    setTailEntries,
    setTailError,
    setTailStreamConnecting,
    setTailStreamExpiresAt,
    setTailStreamLastEventAt,
    setTailStreamNextRetryAt,
    setTailStreamReconnects,
    setTailStreamSessionId,
  } = t;

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
        if (!cancelled) setTailError(err instanceof Error ? err.message : 'Tail 刷新失败');
      }
    };
    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  });

  const startTailStream = usePersistFn(() => {
    const controller = new AbortController();
    let cancelled = false;
    let retryTimer: number | null = null;
    let attempt = 0;
    const wait = (ms: number) =>
      new Promise<void>((r) => {
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          r();
        }, ms);
      });
    const open = async () => {
      while (!cancelled && !controller.signal.aborted) {
        const rc = tailCursorRef.current;
        const params: Record<string, string> = {
          limit: '100',
          pollIntervalMs: '3000',
          maxSessionMs: String(streamSessionMaxMs),
        };
        if (rc) params.cursor = rc;
        try {
          setTailStreamConnecting(true);
          const response = await stream(`/logs/streams/${selectedStreamId}/events`, {
            params,
            signal: controller.signal,
            headers: rc ? { 'Last-Event-ID': rc } : undefined,
          });
          if (cancelled) break;
          setTailStreamConnecting(false);
          setTailStreamNextRetryAt(null);
          setTailError('');
          await readSseStream(response, (event, data) => {
            if (cancelled) return;
            const p = data as Record<string, unknown>;
            setTailStreamLastEventAt((p.at as string) || new Date().toISOString());
            if (typeof p.sessionId === 'string') {
              const isNew = p.sessionId !== tailStreamSessionIdRef.current;
              tailStreamSessionIdRef.current = p.sessionId;
              setTailStreamSessionId(p.sessionId);
              if (isNew) void refreshStreamSessions();
            }
            if (typeof p.expiresAt === 'string') setTailStreamExpiresAt(p.expiresAt);
            if (typeof p.cursor === 'string') {
              tailCursorRef.current = p.cursor;
              setTailCursor(p.cursor);
            }
            if (event === 'entries' && Array.isArray(p.entries)) {
              setTailEntries((c: LogEntry[]) => mergeTimeline(c, p.entries as LogEntry[]));
              setTailError('');
            }
            if (event === 'error') setTailError((p.message as string) || '日志流式 Tail 失败');
            if (event === 'closing') {
              setTailError(
                p.reason === 'max_session_duration'
                  ? '日志流会话到期，正在续接'
                  : '日志流会话关闭，正在续接',
              );
              void refreshStreamSessions();
            }
          });
          if (cancelled || controller.signal.aborted) break;
          throw new Error('实时日志流连接已断开');
        } catch (err) {
          if (cancelled || controller.signal.aborted) break;
          attempt++;
          const delay = getStreamReconnectDelayMs(attempt);
          setTailStreamReconnects(attempt);
          setTailStreamConnecting(false);
          setTailStreamNextRetryAt(new Date(Date.now() + delay).toISOString());
          setTailError(
            `${err instanceof Error ? err.message : '实时日志流连接失败'}，${Math.ceil(delay / 1000)} 秒后重连`,
          );
          await wait(delay);
          if (!cancelled) setTailStreamConnecting(true);
        }
      }
      if (!cancelled) setTailStreamConnecting(false);
    };
    setTailStreamReconnects(0);
    setTailStreamNextRetryAt(null);
    void open();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      controller.abort();
    };
  });

  useEffect(() => {
    tailCursorRef.current = tailCursor;
  }, [tailCursor, tailCursorRef]);

  useEffect(() => {
    tailStreamSessionIdRef.current = tailStreamSessionId;
  }, [tailStreamSessionId, tailStreamSessionIdRef]);

  useEffect(() => {
    if (!tailAutoRefresh || !selectedStreamId) return;
    return startTailPolling();
  }, [selectedStreamId, startTailPolling, tailAutoRefresh]);

  useEffect(() => {
    if (!tailStreaming || !selectedStreamId) return;
    return startTailStream();
  }, [selectedStreamId, startTailStream, tailStreaming]);
}
