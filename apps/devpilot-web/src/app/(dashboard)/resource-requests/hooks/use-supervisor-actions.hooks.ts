/**
 * 供给运行 Supervisor 级动作 Hook
 *
 * 单一职责：执行 supervisor 域的两个写动作——恢复超时运行、处理下一条队列运行。
 * 从 use-provisioning-run-actions 拆出，使主 hook 聚焦于"运行记录列表 + 单运行动作"。
 * 状态（recovering/processing、supervisor 错误）与此处绑定；执行依赖经入参注入。
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { ResourceProvisioningRunSupervisor } from '../types';

interface SupervisorActionOptions {
  /** 当前 supervisor 摘要（取 staleAfterSeconds 默认值）。 */
  runSupervisor: ResourceProvisioningRunSupervisor | null;
  /** 当前打开的运行记录列表目标；存在时动作完成后一并刷新运行列表。 */
  runsTargetId: string | null;
  /** 刷新申请列表。 */
  refreshRequests: () => Promise<void>;
  /** 刷新 supervisor 摘要。 */
  refreshRunSupervisor: () => Promise<void>;
  /** 刷新运行记录列表。 */
  refreshProvisioningRuns: () => Promise<void>;
}

export interface SupervisorActionsApi {
  recoveringStaleRuns: boolean;
  processingQueuedRun: boolean;
  supervisorActionError: string;
  runRecoverStale: () => Promise<void>;
  runProcessNext: () => Promise<void>;
}

export function useSupervisorActions({
  runSupervisor,
  runsTargetId,
  refreshRequests,
  refreshRunSupervisor,
  refreshProvisioningRuns,
}: SupervisorActionOptions): SupervisorActionsApi {
  const t = useTranslations('resourceRequests');
  const [recoveringStaleRuns, setRecoveringStaleRuns] = useState(false);
  const [processingQueuedRun, setProcessingQueuedRun] = useState(false);
  const [supervisorActionError, setSupervisorActionError] = useState('');

  const runRecoverStale = usePersistFn(async () => {
    setRecoveringStaleRuns(true);
    setSupervisorActionError('');
    try {
      await apiRequest('POST:/resource-requests/provisioning-runs/recover-stale', {
        limit: 20,
        staleAfterSeconds: String(runSupervisor?.staleAfterSeconds || 1800),
      });
      await Promise.all([
        refreshRequests(),
        refreshRunSupervisor(),
        runsTargetId ? refreshProvisioningRuns() : Promise.resolve(),
      ]);
    } catch (err) {
      setSupervisorActionError(err instanceof Error ? err.message : t('recoverStaleFailed'));
    } finally {
      setRecoveringStaleRuns(false);
    }
  });

  const runProcessNext = usePersistFn(async () => {
    setProcessingQueuedRun(true);
    setSupervisorActionError('');
    try {
      await apiRequest('POST:/resource-requests/provisioning-runs/process-next', {});
      await Promise.all([
        refreshRequests(),
        refreshRunSupervisor(),
        runsTargetId ? refreshProvisioningRuns() : Promise.resolve(),
      ]);
    } catch (err) {
      setSupervisorActionError(err instanceof Error ? err.message : t('processNextFailed'));
    } finally {
      setProcessingQueuedRun(false);
    }
  });

  return {
    recoveringStaleRuns,
    processingQueuedRun,
    supervisorActionError,
    runRecoverStale,
    runProcessNext,
  };
}
