/**
 * 发布进度重试 Hook（第 0 步）
 *
 * 单一职责：进度页时间线上的「重试」按钮请求 —— 重试构建、重试预发部署。
 * 预发部署重试时制品自动取最新成功构建，用户不选择。
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type {
  ReleaseBuildItem,
  ReleaseBuildListResponse,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';

export type RetryTarget = 'build' | 'staging';

export function useReleaseStepRetry(
  projectId: string,
  releaseOrderId: string,
  onRetried: () => Promise<unknown> | void,
) {
  const [retrying, setRetrying] = useState<RetryTarget | null>(null);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const run = useCallback(
    async (target: RetryTarget, action: () => Promise<unknown>) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setRetrying(target);
      setError('');
      try {
        await action();
        await onRetried();
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        return false;
      } finally {
        inFlight.current = false;
        setRetrying(null);
      }
    },
    [onRetried],
  );

  const retryBuild = useCallback(
    () =>
      run('build', () =>
        apiRequest<ReleaseBuildItem>(
          `POST:/projects/${projectId}/delivery/releases/${releaseOrderId}/builds`,
          {},
        ),
      ),
    [projectId, releaseOrderId, run],
  );

  const retryStagingDeploy = useCallback(async () => {
    let manifestId: string | null = null;
    try {
      manifestId = await latestSucceededManifestId(projectId, releaseOrderId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return false;
    }
    if (!manifestId) {
      // 没有可用制品（最新构建未成功）：交给组件提示先重试构建。
      setError('NO_MANIFEST');
      return false;
    }
    return run('staging', () =>
      apiRequest<ReleaseStagingDeploymentItem>(
        `POST:/projects/${projectId}/delivery/releases/${releaseOrderId}/staging-deployments`,
        { manifestId },
      ),
    );
  }, [projectId, releaseOrderId, run]);

  return { retrying, error, retryBuild, retryStagingDeploy };
}

async function latestSucceededManifestId(projectId: string, releaseOrderId: string) {
  const builds = await apiRequest<ReleaseBuildListResponse>(
    `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/builds?take=10`,
  );
  const build = builds.items.find((item) => item.status === 'succeeded' && item.manifest);
  return build?.manifest?.id ?? null;
}
