'use client';
import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import type { StageKey } from '@/lib/contracts';

interface LogState { scope: string; text: string; bytes: number; complete: boolean; loading: boolean; error: unknown }
const emptyLog = (scope: string, loading = false): LogState => ({ scope, text: '', bytes: 0, complete: false, loading, error: null });

export function useStageLog(taskId: string, stage: StageKey | null, service: string, running: boolean) {
  const scope = JSON.stringify([taskId, stage, service]);
  const [state, setState] = useState<LogState>(emptyLog(scope, !!taskId && !!stage));
  useEffect(() => {
    setState(emptyLog(scope, !!taskId && !!stage));
    if (!taskId || !stage) return;
    let cancelled = false;
    let offset = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();
    const poll = async () => {
      if (cancelled) return;
      setState(current => ({ ...current, loading: offset === 0 }));
      try {
        const log = await request('GET:/tasks/:id/logs', { id: taskId, stage, ...(service ? { service } : {}), offset }, { signal: abort.signal });
        if (cancelled) return;
        // The server's flag means archival ended, not that every page was read.
        setState(current => ({ ...current, text: current.text + log.text, bytes: log.totalBytes, complete: log.complete && log.nextOffset >= log.totalBytes, error: null }));
        const advanced = log.nextOffset > offset;
        offset = log.nextOffset;
        if (advanced && offset < log.totalBytes) timer = setTimeout(poll, 30);
        else if (running || !log.complete) timer = setTimeout(poll, 1000);
      } catch (failure) {
        if (!cancelled) { setState(current => ({ ...current, error: failure })); timer = setTimeout(poll, 3000); }
      } finally { if (!cancelled) setState(current => ({ ...current, loading: false })); }
    };
    void poll();
    return () => { cancelled = true; abort.abort(); if (timer) clearTimeout(timer); };
  }, [taskId, stage, service, running, scope]);
  // Hide the previous scope synchronously, before the effect resets its cursor.
  return state.scope === scope ? state : emptyLog(scope, !!taskId && !!stage);
}
