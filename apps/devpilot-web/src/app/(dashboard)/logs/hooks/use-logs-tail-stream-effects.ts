/**
 * 日志 Tail 流式副作用
 *
 * 单一职责：同步 Tail refs，维护 SSE 实时流连接生命周期。
 */

import { useEffect } from 'react';
import { usePersistFn } from '@svton/hooks';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { buildHeaders, buildStreamUrl } from '@/lib/api-client/stream';
import type { LogsState } from './use-logs-state';
import type { LogsTailState } from './use-logs-tail-state';
import type { LogEntry } from '../types-stream';
import { getStreamReconnectDelayMs } from '../utils-sse';

const streamSessionMaxMs = 5 * 60 * 1000;

interface UseLogsTailStreamEffectsArgs {
  mergeTimeline: (current: LogEntry[], incoming: LogEntry[]) => LogEntry[];
  refreshStreamSessions: () => Promise<void>;
  selectedStreamId: string;
  t: LogsTailState;
  tailCursorRef: LogsState['tailCursorRef'];
  tailStreamSessionIdRef: LogsState['tailStreamSessionIdRef'];
}

export function useLogsTailStreamEffects(args: UseLogsTailStreamEffectsArgs) {
  const {
    mergeTimeline,
    refreshStreamSessions,
    selectedStreamId,
    t,
    tailCursorRef,
    tailStreamSessionIdRef,
  } = args;
  const {
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

  const startTailStream = usePersistFn(() => {
    const controller = new AbortController();
    let cancelled = false;
    let attempt = 0;

    const handleMessage = (event: string, raw: string) => {
      if (cancelled) return;
      let p: Record<string, unknown>;
      try {
        p = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        p = { message: raw };
      }
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
    };

    const open = async () => {
      while (!cancelled && !controller.signal.aborted) {
        attempt = 0;
        const rc = tailCursorRef.current;
        const params: Record<string, string> = {
          limit: '100',
          pollIntervalMs: '3000',
          maxSessionMs: String(streamSessionMaxMs),
        };
        if (rc) params.cursor = rc;

        try {
          setTailStreamConnecting(true);
          await fetchEventSource(
            buildStreamUrl(`/logs/streams/${selectedStreamId}/events`, params),
            {
              method: 'GET',
              signal: controller.signal,
              headers: buildHeaders(rc ? { 'Last-Event-ID': rc } : undefined),
              openWhenHidden: true,
              async onopen(response) {
                if (cancelled) throw new DOMException('cancelled', 'AbortError');
                if (
                  response.ok &&
                  response.headers.get('content-type')?.includes('text/event-stream')
                ) {
                  setTailStreamConnecting(false);
                  setTailStreamNextRetryAt(null);
                  setTailError('');
                  return;
                }
                throw new Error(`实时日志流连接失败：HTTP ${response.status}`);
              },
              onmessage(ev) {
                handleMessage(ev.event || 'message', ev.data);
              },
              onclose() {
                // 服务端正常关闭会话，外层 while 会重连（续接 cursor）。
                if (!cancelled) throw new Error('实时日志流连接已断开');
              },
              onerror(err) {
                if (cancelled || controller.signal.aborted) throw err; // 停止重连
                attempt += 1;
                const delay = getStreamReconnectDelayMs(attempt);
                setTailStreamReconnects(attempt);
                setTailStreamConnecting(false);
                setTailStreamNextRetryAt(new Date(Date.now() + delay).toISOString());
                setTailError(
                  `${err instanceof Error ? err.message : '实时日志流连接失败'}，${Math.ceil(delay / 1000)} 秒后重连`,
                );
                // 返回 undefined 让 fetchEventSource 等待默认间隔后重试；
                // 我们的退避 UI 已展示，靠 onclose 抛错进入外层 while 重新建立带新 cursor 的连接。
                return undefined;
              },
            },
          );
          // fetchEventSource resolve 意味着连接结束（onclose 抛错被它捕获后会 resolve）
          if (!cancelled && !controller.signal.aborted) {
            throw new Error('实时日志流连接已断开');
          }
        } catch (err) {
          if (cancelled || controller.signal.aborted) break;
          attempt += 1;
          const delay = getStreamReconnectDelayMs(attempt);
          setTailStreamReconnects(attempt);
          setTailStreamConnecting(false);
          setTailStreamNextRetryAt(new Date(Date.now() + delay).toISOString());
          setTailError(
            `${err instanceof Error ? err.message : '实时日志流连接失败'}，${Math.ceil(delay / 1000)} 秒后重连`,
          );
          await new Promise<void>((r) => {
            setTimeout(r, delay);
          });
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
    if (!tailStreaming || !selectedStreamId) return;
    return startTailStream();
  }, [selectedStreamId, startTailStream, tailStreaming]);
}
