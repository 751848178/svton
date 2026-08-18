/**
 * 发布进度轮询 Hook（第 0 步）
 *
 * 单一职责：拉取并轮询一个发布单的四域数据（详情/构建/预发部署/生产发布），
 * 用 release-progress.model 归并为四步时间线视图；运行中（含等待审批）每 5s
 * 轮询，终态自动停止（参照 use-release-polling.hooks.ts 模式）。
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type {
  ReleaseBuildListResponse,
  ReleaseOrderDetail,
  ReleaseStagingDeploymentListResponse,
} from '../../types/release-order.types';
import type { ProductionReleaseListResponse } from '../../types/release-production.types';
import {
  buildReleaseProgressView,
  type ReleaseProgressView,
} from '../components/release-progress.model';

const POLL_INTERVAL_MS = 5_000;

interface ProgressData {
  detail: ReleaseOrderDetail | null;
  builds: ReleaseBuildListResponse['items'];
  stagingDeployments: ReleaseStagingDeploymentListResponse['items'];
  productionRuns: ProductionReleaseListResponse['items'];
}

export function useReleaseProgress(projectId: string, releaseOrderId: string, enabled = true) {
  const [data, setData] = useState<ProgressData>({
    detail: null,
    builds: [],
    stagingDeployments: [],
    productionRuns: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const loadedOnce = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    if (!loadedOnce.current) setLoading(true);
    try {
      const [detail, builds, staging, production] = await Promise.all([
        apiRequest<ReleaseOrderDetail>(
          `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}`,
        ),
        apiRequest<ReleaseBuildListResponse>(
          `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/builds?take=10`,
        ),
        apiRequest<ReleaseStagingDeploymentListResponse>(
          `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/staging-deployments`,
        ),
        apiRequest<ProductionReleaseListResponse>(
          `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/production-releases`,
        ),
      ]);
      if (!alive.current) return;
      loadedOnce.current = true;
      setError('');
      setData({
        detail: detail.id === releaseOrderId ? detail : null,
        builds: builds.items.filter((item) => item.releaseOrderId === releaseOrderId),
        stagingDeployments: staging.items.filter((item) => item.releaseOrderId === releaseOrderId),
        productionRuns: production.items.filter((item) => item.releaseOrderId === releaseOrderId),
      });
    } catch (caught) {
      if (!alive.current) return;
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [enabled, projectId, releaseOrderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const view: ReleaseProgressView = useMemo(() => buildReleaseProgressView(data), [data]);

  useEffect(() => {
    if (!enabled || !view.running) return;
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, load, view.running]);

  /** 最新成功构建的制品（自动选择，用户不挑）。 */
  const succeededManifestId = useMemo(() => {
    const build = data.builds.find((item) => item.status === 'succeeded' && item.manifest);
    return build?.manifest?.id ?? null;
  }, [data.builds]);

  return {
    ...view,
    detail: data.detail,
    builds: data.builds,
    stagingDeployments: data.stagingDeployments,
    productionRuns: data.productionRuns,
    succeededManifestId,
    loading,
    error,
    reload: load,
  };
}

export type ReleaseProgressController = ReturnType<typeof useReleaseProgress>;
