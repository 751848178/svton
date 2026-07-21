/**
 * 资源申请数据 Hook
 *
 * 单一职责：加载申请/资源类型/项目，并组合基础申请动作与运行治理动作。
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { usePollingList } from '@/hooks/use-polling-list';
import { feedback } from '@/components/ui/feedback/feedback';
import type { ResourceRequest, ResourceType, Project } from '../types';
import { useProvisioningRunActions } from './use-provisioning-run-actions';

export function useResourceRequests() {
  const t = useTranslations('resourceRequests');
  // 申请列表内嵌 result.provisioning.status（GET:/resource-requests），存在 queued/running/pending
  // 供给运行时由 usePollingList 数据驱动保持 5s 轮询，终态后自动停止。
  const requestsSWR = usePollingList<ResourceRequest>(
    'GET:/resource-requests',
    () => apiRequest<ResourceRequest[]>('GET:/resource-requests'),
    {
      isActive: (r) =>
        ['queued', 'running', 'pending'].includes(r.result?.provisioning?.status || ''),
      interval: 5000,
    },
  );
  const requests = useMemo(() => requestsSWR.data ?? [], [requestsSWR.data]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadData = usePersistFn(async () => {
    // requests 走 SWR mutate：手动 reload 与轮询共享缓存，不会双份请求。
    const [requestResult, typeResult, projectResult] = await Promise.allSettled([
      requestsSWR.mutate(),
      apiRequest<ResourceType[]>('GET:/resource-types'),
      apiRequest<Project[]>('GET:/projects'),
    ]);
    const failures: string[] = [];

    if (requestResult.status === 'rejected') {
      failures.push(t('loadRequestsFailed', { reason: toErrorMessage(requestResult.reason) }));
    }

    if (typeResult.status === 'fulfilled') setResourceTypes(typeResult.value);
    else failures.push(t('loadResourceTypesFailed', { reason: toErrorMessage(typeResult.reason) }));

    if (projectResult.status === 'fulfilled') setProjects(projectResult.value);
    else failures.push(t('loadProjectsFailed', { reason: toErrorMessage(projectResult.reason) }));

    setDataError(failures.join('；'));
    setLoading(false);
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  const provisioningRunActions = useProvisioningRunActions({ refreshRequests: loadData });

  const counts = useMemo(
    () =>
      requests.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {}),
    [requests],
  );

  // 取消/重试的确认弹窗由页面层（page.tsx ConfirmDialog）把关，这里只执行动作并反馈结果。
  const cancelRequest = usePersistFn(async (id: string) => {
    try {
      await apiRequest(`POST:/resource-requests/${id}/cancel`);
      await loadData();
      feedback.success(t('cancelSuccess'));
    } catch (error) {
      console.error('Failed to cancel resource request:', error);
      feedback.error(t('cancelFailed'));
    }
  });

  const reviewRequest = usePersistFn(async (id: string, status: 'approved' | 'rejected') => {
    try {
      await apiRequest(`POST:/resource-requests/${id}/review`, { status });
      await loadData();
      feedback.success(status === 'approved' ? t('reviewSuccessApproved') : t('reviewSuccessRejected'));
    } catch (error) {
      console.error('Failed to review resource request:', error);
      feedback.error(t('reviewFailed'));
    }
  });

  const retryProvisioning = usePersistFn(async (request: ResourceRequest) => {
    setRetryingId(request.id);
    try {
      await apiRequest(`POST:/resource-requests/${request.id}/retry-provisioning`);
      await loadData();
      feedback.success(t('retrySuccess'));
    } catch (error) {
      console.error('Failed to retry provisioning:', error);
      feedback.error(t('retryFailed'));
    } finally {
      setRetryingId(null);
    }
  });

  return {
    requests,
    resourceTypes,
    projects,
    loading,
    // 手动 loadData 的失败汇总与轮询期间的 SWR 错误合并，保持原有 dataError 导出语义。
    dataError:
      dataError ||
      (requestsSWR.error
        ? t('loadRequestsFailed', { reason: requestsSWR.error.message })
        : ''),
    counts,
    retryingId,
    ...provisioningRunActions,
    cancelRequest,
    reviewRequest,
    retryProvisioning,
    reload: loadData,
  };
}

function toErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}
