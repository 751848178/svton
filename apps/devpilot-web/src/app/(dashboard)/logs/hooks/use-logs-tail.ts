/**
 * 日志 SSE Tail Hook
 *
 * 单一职责：Tail 轮询、SSE 实时流式（含重连）、会话关闭。
 */

import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { LogsState } from './use-logs-state';
import type { LogsTailState } from './use-logs-tail-state';
import { useLogsTailMetadataEffects } from './use-logs-tail-metadata-effects';
import { useLogsTailStreamEffects } from './use-logs-tail-stream-effects';
import type { LogStream, LogEntry, LogTailResponse, LogStreamSession } from '../types-stream';

interface UseLogsTailArgs {
  s: LogsState;
  t: LogsTailState;
  selectedStream: LogStream | null;
  isSelectedSlsStream: boolean;
  loadData: () => Promise<void>;
}

export function useLogsTail(args: UseLogsTailArgs) {
  const { s, t, selectedStream } = args;
  const { selectedStreamId, setStreamSessions, tailCursorRef, tailStreamSessionIdRef } = s;
  const {
    tailCursor,
    tailStreamSessionId,
    setClosingStreamSessionId,
    setTailCursor,
    setTailEntries,
    setTailError,
    setTailLoading,
    setTailStreamConnecting,
    setTailStreamExpiresAt,
    setTailStreamSessionId,
    setTailStreaming,
  } = t;

  const refreshStreamSessions = usePersistFn(async () => {
    try {
      setStreamSessions(await apiRequest<LogStreamSession[]>('GET:/logs/stream-sessions'));
    } catch {
      /* ignore */
    }
  });

  const loadTailEntries = usePersistFn((cursor?: string | null) => {
    const params: Record<string, string> = { limit: '100' };
    if (cursor) params.cursor = cursor;
    return apiRequest<LogTailResponse>(`GET:/logs/streams/${selectedStreamId}/tail`, params);
  });

  const refreshTailEntries = usePersistFn(async (reset: boolean) => {
    if (!selectedStreamId) {
      alert('请选择日志流');
      return;
    }
    setTailLoading(true);
    setTailError('');
    try {
      const response = await loadTailEntries(reset ? null : tailCursor);
      setTailCursor(response.cursor || null);
      setTailEntries((cur: LogEntry[]) => mergeTimeline(reset ? [] : cur, response.entries));
    } catch (err) {
      setTailError(err instanceof Error ? err.message : 'Tail 刷新失败');
    } finally {
      setTailLoading(false);
    }
  });

  const closeStreamSession = usePersistFn(async (sessionId: string) => {
    setClosingStreamSessionId(sessionId);
    setTailError('');
    try {
      await apiRequest(`POST:/logs/stream-sessions/${sessionId}/close`);
      if (sessionId === tailStreamSessionId) {
        setTailStreaming(false);
        setTailStreamConnecting(false);
        setTailStreamSessionId(null);
        setTailStreamExpiresAt(null);
      }
      await refreshStreamSessions();
    } catch (err) {
      setTailError(err instanceof Error ? err.message : '关闭日志流会话失败');
    } finally {
      setClosingStreamSessionId(null);
    }
  });

  useLogsTailMetadataEffects({
    selectedStream,
    selectedStreamId,
    t,
    tailCursorRef,
  });
  useLogsTailStreamEffects({
    loadTailEntries,
    mergeTimeline,
    refreshStreamSessions,
    selectedStreamId,
    t,
    tailCursorRef,
    tailStreamSessionIdRef,
  });

  return { refreshTailEntries, closeStreamSession, refreshStreamSessions };
}

function mergeTimeline(current: LogEntry[], incoming: LogEntry[]): LogEntry[] {
  const seen = new Set(current.map((e) => e.id));
  return [...current, ...incoming.filter((e) => !seen.has(e.id))];
}
