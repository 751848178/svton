/**
 * 发布能力 Hook（F383, architect D9）
 *
 * 单一职责：挂载时拉取 GET /release-plans/capability?projectId=?，
 * 缓存到 state 并暴露 { capability, loading, error }。
 * 失败不抛到上层：按「未知 = 允许尝试写」兜底，避免一次 capability 失败锁死整个 tab。
 */
'use client';

import { useEffect, useState } from 'react';
import type { ReleaseCapability } from '../types/releases';

interface UseReleaseCapabilityArgs {
  projectId: string;
  fetcher: (projectId?: string) => Promise<ReleaseCapability>;
}

interface UseReleaseCapabilityResult {
  capability: ReleaseCapability | null;
  loading: boolean;
  error: string;
}

const FALLBACK: ReleaseCapability = { enabled: true, canCancel: true, reason: null };

export function useReleaseCapability({
  projectId,
  fetcher,
}: UseReleaseCapabilityArgs): UseReleaseCapabilityResult {
  const [capability, setCapability] = useState<ReleaseCapability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetcher(projectId)
      .then((c) => {
        if (cancelled) return;
        setCapability(c);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        // 拉取失败时按「允许写」兜底，避免锁死；真实失败在调用写动作时由 403 兜底。
        setCapability(FALLBACK);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, fetcher]);

  return { capability, loading, error };
}
