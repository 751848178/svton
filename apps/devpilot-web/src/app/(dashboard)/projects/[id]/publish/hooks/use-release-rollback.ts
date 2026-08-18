/**
 * 回滚 Hook（第 0 步）
 *
 * 单一职责：解析回滚目标（生产环境当前版本的上一版本，resolveRollbackTarget
 * 纯函数），并执行两段式回滚 —— POST recovery/preview（回滚后变化一屏）→
 * POST recovery/confirm（确认回滚）。路径与既有 use-recovery-confirm.ts 一致。
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type {
  EnvironmentVersionRecoveryPreview,
  EnvironmentVersionsResponse,
} from '../../types/environment-version.types';
import { resolveRollbackTarget } from '../components/rollback-target.model';

export function useReleaseRollback(projectId: string) {
  const [versions, setVersions] = useState<EnvironmentVersionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<EnvironmentVersionRecoveryPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVersions(
        await apiRequest<EnvironmentVersionsResponse>(
          `GET:/projects/${encodeURIComponent(projectId)}/delivery/environment-versions`,
        ),
      );
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const target = resolveRollbackTarget(versions);

  const openPreview = useCallback(async () => {
    if (!target || inFlight.current) return null;
    inFlight.current = true;
    setPreviewing(true);
    setError('');
    try {
      const result = await apiRequest<EnvironmentVersionRecoveryPreview>(
        `POST:/projects/${encodeURIComponent(projectId)}/delivery/environment-versions/${target.environmentId}/recovery/preview`,
        { sourceVersionId: target.previousVersionId },
      );
      setPreview(result);
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      inFlight.current = false;
      setPreviewing(false);
    }
  }, [projectId, target]);

  const confirm = useCallback(async () => {
    if (!target || !preview || inFlight.current) return null;
    inFlight.current = true;
    setConfirming(true);
    setError('');
    try {
      const result = await apiRequest(
        `POST:/projects/${encodeURIComponent(projectId)}/delivery/environment-versions/${target.environmentId}/recovery/confirm`,
        {
          sourceVersionId: target.previousVersionId,
          expectedInputHash: preview.inputHash,
          idempotencyKey: `step0-recovery-${target.environmentId}-${target.previousVersionId}`,
        },
      );
      setPreview(null);
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      inFlight.current = false;
      setConfirming(false);
    }
  }, [preview, projectId, target]);

  return {
    target,
    loading,
    preview,
    previewing,
    confirming,
    error,
    reload: load,
    openPreview,
    confirm,
  };
}
