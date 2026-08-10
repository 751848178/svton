'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';

/**
 * 资源连接健康（AC-SET-029）
 *
 * 单一职责：为资源绑定子区按项目一次性读取真实 ResourceConnectionRun 探测
 * 结果（GET /resource-control/connection-runs?projectId=），按键 resourceId
 * 提供最近一次探测。探测缺失/读取失败时诚实标记不可用。
 */

export type ConnectionProbeState = 'ok' | 'failed' | 'none' | 'unavailable';

export type ResourceConnectionProbe = {
  status: ConnectionProbeState;
  at: string | null;
};

type ConnectionRun = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string | null;
  error?: string | null;
  resource?: { id: string } | null;
};

const OK_STATUSES = new Set(['success', 'succeeded', 'passed', 'ok', 'online']);

export function useResourceConnectionHealth(projectId: string) {
  const [probes, setProbes] = useState<Record<string, ResourceConnectionProbe>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const runs = await apiRequest<ConnectionRun[]>(
        `GET:/resource-control/connection-runs?projectId=${encodeURIComponent(projectId)}`,
      );
      const latestByResource: Record<string, ConnectionRun> = {};
      for (const run of runs) {
        const resourceId = run.resource?.id;
        if (!resourceId) continue;
        if (!latestByResource[resourceId]) latestByResource[resourceId] = run;
      }
      const next: Record<string, ResourceConnectionProbe> = {};
      for (const [resourceId, run] of Object.entries(latestByResource)) {
        next[resourceId] = {
          status: OK_STATUSES.has(run.status.toLowerCase()) ? 'ok' : 'failed',
          at: run.startedAt ?? null,
        };
      }
      setProbes(next);
    } catch {
      setError('load failed');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { probes, loading, error, reload: load };
}
