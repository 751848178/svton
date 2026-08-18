/**
 * 生产发布 Hook（第 0 步）
 *
 * 单一职责：预发部署成功后的「发布到生产」两段式操作 ——
 * GET production-preview（差异摘要）→ POST production-releases（确认发布）。
 * 制品沿用最新成功构建（由调用方传入 manifestId），需审批时进度页显示等待审批。
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type {
  ProductionReleasePreview,
  ProductionReleaseRun,
} from '../../types/release-production.types';

export function useReleaseProduction(
  projectId: string,
  releaseOrderId: string,
  manifestId: string | null,
) {
  const [preview, setPreview] = useState<ProductionReleasePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const loadPreview = useCallback(async () => {
    if (!manifestId) return null;
    setLoadingPreview(true);
    setError('');
    try {
      const result = await apiRequest<ProductionReleasePreview>(
        `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/production-preview?manifestId=${encodeURIComponent(manifestId)}`,
      );
      setPreview(result);
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      setLoadingPreview(false);
    }
  }, [manifestId, projectId, releaseOrderId]);

  const confirm = useCallback(async () => {
    if (!manifestId || inFlight.current) return null;
    inFlight.current = true;
    setConfirming(true);
    setError('');
    try {
      const current =
        preview && preview.snapshot.manifest.id === manifestId
          ? preview
          : await apiRequest<ProductionReleasePreview>(
              `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/production-preview?manifestId=${encodeURIComponent(manifestId)}`,
            );
      const run = await apiRequest<ProductionReleaseRun>(
        `POST:/projects/${projectId}/delivery/releases/${releaseOrderId}/production-releases`,
        {
          manifestId,
          expectedInputHash: current.inputHash,
          idempotencyKey: crypto.randomUUID(),
        },
      );
      setPreview(null);
      return run;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      inFlight.current = false;
      setConfirming(false);
    }
  }, [manifestId, preview, projectId, releaseOrderId]);

  return { preview, loadingPreview, confirming, error, loadPreview, confirm };
}
