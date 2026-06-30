/**
 * 日志 SSE Tail Hook
 *
 * 单一职责：Tail 轮询、SSE 实时流式（含重连）、会话关闭。
 */

import { useEffect } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { stream } from '@/lib/api-client/stream';
import type { LogsState } from './use-logs-state';
import type { LogsTailState } from './use-logs-tail-state';
import type { LogStream, LogEntry, LogTailResponse, LogStreamSession } from '../types-stream';
import { readSseStream, getStreamReconnectDelayMs } from '../utils-sse';
import {
  readRedactionMetadata,
  readSlsBackfillMetadata,
  readServerFollowMetadata,
} from '../utils-metadata';

const streamSessionMaxMs = 5 * 60 * 1000;

interface UseLogsTailArgs {
  s: LogsState;
  t: LogsTailState;
  selectedStream: LogStream | null;
  isSelectedSlsStream: boolean;
  loadData: () => Promise<void>;
}

export function useLogsTail(args: UseLogsTailArgs) {
  const { s, t, selectedStream, loadData } = args;

  const refreshStreamSessions = usePersistFn(async () => {
    try {
      s.setStreamSessions(await apiRequest<LogStreamSession[]>('GET:/logs/stream-sessions'));
    } catch {
      /* ignore */
    }
  });

  const loadTailEntries = usePersistFn((cursor?: string | null) => {
    const params: Record<string, string> = { limit: '100' };
    if (cursor) params.cursor = cursor;
    return apiRequest<LogTailResponse>(`GET:/logs/streams/${s.selectedStreamId}/tail`, params);
  });

  const refreshTailEntries = usePersistFn(async (reset: boolean) => {
    if (!s.selectedStreamId) {
      alert('请选择日志流');
      return;
    }
    t.setTailLoading(true);
    t.setTailError('');
    try {
      const response = await loadTailEntries(reset ? null : t.tailCursor);
      t.setTailCursor(response.cursor || null);
      t.setTailEntries((cur: LogEntry[]) => mergeTimeline(reset ? [] : cur, response.entries));
    } catch (err) {
      t.setTailError(err instanceof Error ? err.message : 'Tail 刷新失败');
    } finally {
      t.setTailLoading(false);
    }
  });

  const closeStreamSession = usePersistFn(async (sessionId: string) => {
    t.setClosingStreamSessionId(sessionId);
    t.setTailError('');
    try {
      await apiRequest(`POST:/logs/stream-sessions/${sessionId}/close`);
      if (sessionId === t.tailStreamSessionId) {
        t.setTailStreaming(false);
        t.setTailStreamConnecting(false);
        t.setTailStreamSessionId(null);
        t.setTailStreamExpiresAt(null);
      }
      await refreshStreamSessions();
    } catch (err) {
      t.setTailError(err instanceof Error ? err.message : '关闭日志流会话失败');
    } finally {
      t.setClosingStreamSessionId(null);
    }
  });

  useEffect(() => {
    s.tailCursorRef.current = t.tailCursor;
  }, [t.tailCursor]);
  useEffect(() => {
    s.tailStreamSessionIdRef.current = t.tailStreamSessionId;
  }, [t.tailStreamSessionId]);

  useEffect(() => {
    const redaction = readRedactionMetadata(selectedStream?.metadata);
    t.setRedactionExtraKeys((redaction.extraKeys || []).join(', '));
    t.setRedactionMaskEmails(redaction.maskEmails);
    t.setRedactionMaskIpAddresses(redaction.maskIpAddresses);
    const sls = readSlsBackfillMetadata(selectedStream?.metadata);
    t.setSlsBackfillEnabled(sls.enabled);
    t.setSlsBackfillLive(sls.live);
    t.setSlsBackfillConfirmLiveRead(sls.confirmLiveRead);
    t.setSlsBackfillQuery(sls.query);
    t.setSlsBackfillWindowMinutes(sls.windowMinutes);
    t.setSlsBackfillLimit(sls.limit);
    t.setSlsBackfillIntervalMinutes(sls.intervalMinutes);
    const follow = readServerFollowMetadata(selectedStream?.metadata);
    t.setServerFollowEnabled(follow.enabled);
    t.setServerFollowLive(follow.live);
    t.setServerFollowConfirmLiveRead(follow.confirmLiveRead);
    t.setServerFollowQueue(follow.queue);
    t.setServerFollowTail(follow.tail);
    t.setServerFollowIntervalMinutes(follow.intervalMinutes);
    t.setServerFollowMaxAttempts(follow.maxAttempts);
  }, [selectedStream?.id, selectedStream?.metadata]);

  useEffect(() => {
    t.setTailEntries([]);
    t.setTailCursor(null);
    s.tailCursorRef.current = null;
    t.setTailError('');
    t.setTailStreaming(false);
    t.setTailStreamConnecting(false);
    t.setTailStreamLastEventAt(null);
    t.setTailStreamReconnects(0);
    t.setTailStreamNextRetryAt(null);
    t.setTailStreamSessionId(null);
    t.setTailStreamExpiresAt(null);
    t.setSlsLiveCollect(false);
    t.setSlsConfirmLiveRead(false);
  }, [s.selectedStreamId]);

  useEffect(() => {
    if (!t.tailAutoRefresh || !s.selectedStreamId) return;
    let cancelled = false;
    let cursor = t.tailCursor;
    const poll = async () => {
      try {
        const res = await loadTailEntries(cursor);
        if (cancelled) return;
        cursor = res.cursor || cursor;
        t.setTailCursor(res.cursor || null);
        t.setTailEntries((c: LogEntry[]) => mergeTimeline(c, res.entries));
        t.setTailError('');
      } catch (err) {
        if (!cancelled) t.setTailError(err instanceof Error ? err.message : 'Tail 刷新失败');
      }
    };
    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [t.tailAutoRefresh, s.selectedStreamId]);

  useEffect(() => {
    if (!t.tailStreaming || !s.selectedStreamId) return;
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
        const rc = s.tailCursorRef.current;
        const params: Record<string, string> = {
          limit: '100',
          pollIntervalMs: '3000',
          maxSessionMs: String(streamSessionMaxMs),
        };
        if (rc) params.cursor = rc;
        try {
          t.setTailStreamConnecting(true);
          const response = await stream(`/logs/streams/${s.selectedStreamId}/events`, {
            params,
            signal: controller.signal,
            headers: rc ? { 'Last-Event-ID': rc } : undefined,
          });
          if (cancelled) break;
          t.setTailStreamConnecting(false);
          t.setTailStreamNextRetryAt(null);
          t.setTailError('');
          await readSseStream(response, (event, data) => {
            if (cancelled) return;
            const p = data as Record<string, unknown>;
            t.setTailStreamLastEventAt((p.at as string) || new Date().toISOString());
            if (typeof p.sessionId === 'string') {
              const isNew = p.sessionId !== s.tailStreamSessionIdRef.current;
              s.tailStreamSessionIdRef.current = p.sessionId;
              t.setTailStreamSessionId(p.sessionId);
              if (isNew) void refreshStreamSessions();
            }
            if (typeof p.expiresAt === 'string') t.setTailStreamExpiresAt(p.expiresAt);
            if (typeof p.cursor === 'string') {
              s.tailCursorRef.current = p.cursor;
              t.setTailCursor(p.cursor);
            }
            if (event === 'entries' && Array.isArray(p.entries)) {
              t.setTailEntries((c: LogEntry[]) => mergeTimeline(c, p.entries as LogEntry[]));
              t.setTailError('');
            }
            if (event === 'error') t.setTailError((p.message as string) || '日志流式 Tail 失败');
            if (event === 'closing') {
              t.setTailError(
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
          t.setTailStreamReconnects(attempt);
          t.setTailStreamConnecting(false);
          t.setTailStreamNextRetryAt(new Date(Date.now() + delay).toISOString());
          t.setTailError(
            `${err instanceof Error ? err.message : '实时日志流连接失败'}，${Math.ceil(delay / 1000)} 秒后重连`,
          );
          await wait(delay);
          if (!cancelled) t.setTailStreamConnecting(true);
        }
      }
      if (!cancelled) t.setTailStreamConnecting(false);
    };
    t.setTailStreamReconnects(0);
    t.setTailStreamNextRetryAt(null);
    void open();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      controller.abort();
    };
  }, [t.tailStreaming, s.selectedStreamId]);

  return { refreshTailEntries, closeStreamSession, refreshStreamSessions };
}

function mergeTimeline(current: LogEntry[], incoming: LogEntry[]): LogEntry[] {
  const seen = new Set(current.map((e) => e.id));
  return [...current, ...incoming.filter((e) => !seen.has(e.id))];
}
