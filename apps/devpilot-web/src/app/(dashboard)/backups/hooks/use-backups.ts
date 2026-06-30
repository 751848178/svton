/**
 * 备份域数据 Hook
 *
 * 单一职责：封装备份计划/运行/资源的获取与变更，暴露状态与操作。
 * 回调用 usePersistFn 保证稳定引用（@svton/hooks 优化）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { BackupPlan, BackupRun, ManagedResource, BackupPlanInput } from '../types';
import { isBackupableResource } from '../utils';

export function useBackups() {
  const [plans, setPlans] = useState<BackupPlan[]>([]);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [runningPlanId, setRunningPlanId] = useState('');
  const [updatingPlanId, setUpdatingPlanId] = useState('');
  const [error, setError] = useState('');
  const [queueBackupRuns, setQueueBackupRuns] = useState(false);

  const load = usePersistFn(async (opts?: { keepLoading?: boolean }) => {
    if (opts?.keepLoading !== false) setError('');
    try {
      const [planData, runData, resourceData] = await Promise.all([
        apiRequest<BackupPlan[]>('GET:/backups/plans'),
        apiRequest<BackupRun[]>('GET:/backups/runs'),
        apiRequest<ManagedResource[]>('GET:/resource-control/resources'),
      ]);
      setPlans(planData);
      setRuns(runData);
      setResources(resourceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载备份数据失败');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    load();
  }, [load]);

  const createPlan = usePersistFn(async (input: BackupPlanInput) => {
    setCreating(true);
    setError('');
    try {
      await apiRequest('POST:/backups/plans', input);
      await load({ keepLoading: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建备份计划失败');
    } finally {
      setCreating(false);
    }
  });

  const runPlan = usePersistFn(async (plan: BackupPlan) => {
    setRunningPlanId(plan.id);
    setError('');
    try {
      await apiRequest(`/backups/plans/${plan.id}/runs`, {
        dryRun: true,
        queue: queueBackupRuns && canQueue(plan),
        trigger: 'manual',
      });
      await load({ keepLoading: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成备份计划失败');
    } finally {
      setRunningPlanId('');
    }
  });

  const togglePlanStatus = usePersistFn(async (plan: BackupPlan) => {
    const nextStatus = plan.status === 'active' ? 'paused' : 'active';
    setUpdatingPlanId(plan.id);
    setError('');
    try {
      await apiRequest(`PUT:/backups/plans/${plan.id}`, { status: nextStatus });
      await load({ keepLoading: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新备份计划失败');
    } finally {
      setUpdatingPlanId('');
    }
  });

  const backupableResources = useMemo(() => resources.filter(isBackupableResource), [resources]);

  const stats = useMemo(
    () => ({
      total: plans.length,
      active: plans.filter((p) => p.status === 'active').length,
      blockedRuns: runs.filter((r) => r.status === 'blocked').length,
      failedRuns: runs.filter((r) => r.status === 'failed').length,
    }),
    [plans, runs],
  );

  return {
    plans,
    runs,
    resources,
    backupableResources,
    stats,
    loading,
    creating,
    runningPlanId,
    updatingPlanId,
    error,
    queueBackupRuns,
    setQueueBackupRuns,
    createPlan,
    runPlan,
    togglePlanStatus,
    reload: load,
  };
}

function canQueue(plan: BackupPlan): boolean {
  return plan.resource?.sourceType === 'server';
}
