/**
 * 资源申请数据 Hook
 *
 * 单一职责：加载申请/资源类型/项目，并组合基础申请动作与运行治理动作。
 */

import { useEffect, useMemo, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { ResourceRequest, ResourceType, Project } from '../types';
import { useProvisioningRunActions } from './use-provisioning-run-actions';

export function useResourceRequests() {
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadData = usePersistFn(async () => {
    try {
      const [req, types, proj] = await Promise.all([
        apiRequest<ResourceRequest[]>('GET:/resource-requests'),
        apiRequest<ResourceType[]>('GET:/resource-types'),
        apiRequest<Project[]>('GET:/projects'),
      ]);
      setRequests(req);
      setResourceTypes(types);
      setProjects(proj);
    } finally {
      setLoading(false);
    }
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

  const cancelRequest = usePersistFn(async (id: string) => {
    if (!confirm('确定要取消这条资源申请吗？')) return;
    await apiRequest(`POST:/resource-requests/${id}/cancel`);
    await loadData();
  });

  const reviewRequest = usePersistFn(async (id: string, status: 'approved' | 'rejected') => {
    await apiRequest(`POST:/resource-requests/${id}/review`, { status });
    await loadData();
  });

  const retryProvisioning = usePersistFn(async (request: ResourceRequest) => {
    if (!confirm(`重新触发「${request.title}」的交付处理器吗？`)) return;
    setRetryingId(request.id);
    try {
      await apiRequest(`POST:/resource-requests/${request.id}/retry-provisioning`);
      await loadData();
    } finally {
      setRetryingId(null);
    }
  });

  return {
    requests,
    resourceTypes,
    projects,
    loading,
    counts,
    retryingId,
    ...provisioningRunActions,
    cancelRequest,
    reviewRequest,
    retryProvisioning,
    reload: loadData,
  };
}
