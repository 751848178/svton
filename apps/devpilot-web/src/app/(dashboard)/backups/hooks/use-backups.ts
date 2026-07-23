/**
 * 备份域数据 Hook
 *
 * 单一职责：封装备份计划/运行/资源的获取与变更，暴露状态与操作。
 * 回调用 usePersistFn 保证稳定引用（@svton/hooks 优化）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { usePollingList } from '@/hooks/use-polling-list';
import { feedback } from '@/components/ui/feedback/feedback';
import type { BackupPlan, BackupRun, ManagedResource, BackupPlanInput } from '../types';
import { isBackupableResource } from '../utils';

export function useBackups() {
  const t = useTranslations('backups');
  // 备份运行记录（GET:/backups/runs）：存在 queued/running 运行时保持 10s 轮询，终态后自动停止。
  const runsSWR = usePollingList<BackupRun>(
    'GET:/backups/runs',
    () => apiRequest<BackupRun[]>('GET:/backups/runs'),
    {
      isActive: (run) => run.status === 'queued' || run.status === 'running',
      interval: 10000,
    },
  );
  const runs = useMemo(() => runsSWR.data ?? [], [runsSWR.data]);
  const [plans, setPlans] = useState<BackupPlan[]>([]);
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
      // runs 走 SWR mutate：手动 reload 与轮询共享缓存，不会双份请求。
      const [planData, resourceData] = await Promise.all([
        apiRequest<BackupPlan[]>('GET:/backups/plans'),
        apiRequest<ManagedResource[]>('GET:/resource-control/resources'),
        runsSWR.mutate(),
      ]);
      setPlans(planData);
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

  const createPlan = usePersistFn(async (input: BackupPlanInput): Promise<boolean> => {
    setCreating(true);
    setError('');
    try {
      await apiRequest('POST:/backups/plans', input);
      await load({ keepLoading: false });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建备份计划失败');
      return false;
    } finally {
      setCreating(false);
    }
  });

  const runPlan = usePersistFn(async (plan: BackupPlan) => {
    setRunningPlanId(plan.id);
    setError('');
    try {
      await apiRequest(`POST:/backups/plans/${plan.id}/runs`, {
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

  // 恢复入口由页面层 ConfirmDialog（danger）把关，这里只执行动作并反馈结果。
  // dryRun: true 生成恢复计划（后端 dryRun !== false 时走 planRestore，live 恢复会被 block）。
  const restoreRun = usePersistFn(async (runId: string) => {
    try {
      await apiRequest(`POST:/backups/runs/${runId}/restore`, {
        dryRun: true,
        trigger: 'manual',
      });
      // load 内含 runsSWR.mutate()，恢复产生的新 run 会立即出现在运行记录里并恢复轮询。
      await load({ keepLoading: false });
      feedback.success(t('restoreSuccess'));
    } catch (err) {
      console.error('Failed to restore backup run:', err);
      feedback.error(t('restoreFailed'));
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

  // 手动 load 的错误与轮询期间的 SWR 错误合并为一个 string，保持原有 error 导出语义。
  const errorMessage = error || (runsSWR.error ? runsSWR.error.message : '');

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
    error: errorMessage,
    queueBackupRuns,
    setQueueBackupRuns,
    createPlan,
    runPlan,
    togglePlanStatus,
    restoreRun,
    reload: load,
  };
}

function canQueue(plan: BackupPlan): boolean {
  return plan.resource?.sourceType === 'server';
}
