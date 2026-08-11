/**
 * 环境部署目标 Hook
 *
 * 单一职责：加载 GET /project-environments/:id/targets —— 与部署路径同源的
 * provider-matched 当前目标（AC-SET-023）+ 全部活动绑定（AC-SET-017/024），
 * 并在绑定/解绑/调整后重新拉取。
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { EnvironmentDeploymentTargets } from '../types';

export function useEnvironmentDeploymentTargets(environmentId: string, enabled = true) {
  const [data, setData] = useState<EnvironmentDeploymentTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const targets = await apiRequest<EnvironmentDeploymentTargets>(
        `GET:/project-environments/${environmentId}/targets`,
      );
      setData(targets);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载部署目标失败');
    } finally {
      setLoading(false);
    }
  }, [environmentId]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void load();
  }, [enabled, load]);

  return { data, loading, error, reload: load };
}
