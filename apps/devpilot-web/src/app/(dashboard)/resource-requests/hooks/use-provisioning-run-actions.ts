import { useEffect, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type {
  ResourceProvisioningRun,
  ResourceProvisioningRunSupervisor,
  ResourceRequest,
} from '../types';
import { parseJsonObject } from '../utils';

interface ProvisioningRunActionOptions {
  refreshRequests: () => Promise<void>;
}

export function useProvisioningRunActions({ refreshRequests }: ProvisioningRunActionOptions) {
  const [runsTarget, setRunsTarget] = useState<ResourceRequest | null>(null);
  const [provisioningRuns, setProvisioningRuns] = useState<ResourceProvisioningRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState('');
  const [replayingRunId, setReplayingRunId] = useState<string | null>(null);
  const [reconcilingRunId, setReconcilingRunId] = useState<string | null>(null);
  const [runSupervisor, setRunSupervisor] = useState<ResourceProvisioningRunSupervisor | null>(
    null,
  );
  const [supervisorError, setSupervisorError] = useState('');
  const [recoveringStaleRuns, setRecoveringStaleRuns] = useState(false);
  const [processingQueuedRun, setProcessingQueuedRun] = useState(false);

  const loadRunSupervisor = usePersistFn(async () => {
    try {
      setRunSupervisor(
        await apiRequest<ResourceProvisioningRunSupervisor>(
          'GET:/resource-requests/provisioning-runs/supervisor',
        ),
      );
      setSupervisorError('');
    } catch (err) {
      setSupervisorError(err instanceof Error ? err.message : '加载运行治理摘要失败');
    }
  });

  const loadProvisioningRuns = usePersistFn(async (request: ResourceRequest, reset = false) => {
    if (reset) setProvisioningRuns([]);
    setRunsError('');
    setRunsLoading(true);
    try {
      setProvisioningRuns(
        await apiRequest<ResourceProvisioningRun[]>(
          `GET:/resource-requests/${request.id}/provisioning-runs`,
        ),
      );
    } catch (err) {
      setRunsError(err instanceof Error ? err.message : '加载运行记录失败');
    } finally {
      setRunsLoading(false);
    }
  });

  useEffect(() => {
    loadRunSupervisor();
  }, [loadRunSupervisor]);

  const openProvisioningRuns = usePersistFn(async (request: ResourceRequest) => {
    setRunsTarget(request);
    await loadProvisioningRuns(request, true);
  });

  const replayProvisioningRun = usePersistFn(async (run: ResourceProvisioningRun) => {
    if (!runsTarget) return;
    if (!confirm(`重放「${runsTarget.title}」的这次交付运行吗？`)) return;
    setReplayingRunId(run.id);
    setRunsError('');
    try {
      await apiRequest(
        `POST:/resource-requests/${runsTarget.id}/provisioning-runs/${run.id}/replay`,
      );
      await Promise.all([refreshRequests(), loadProvisioningRuns(runsTarget)]);
    } catch (err) {
      setRunsError(err instanceof Error ? err.message : '重放运行失败');
    } finally {
      setReplayingRunId(null);
    }
  });

  const reconcileProviderProvisioningRun = usePersistFn(async (run: ResourceProvisioningRun) => {
    if (!runsTarget) return;
    const raw = window.prompt('粘贴 providerState JSON 对象');
    if (!raw) return;
    let providerState: Record<string, unknown>;
    try {
      providerState = parseJsonObject(raw, 'providerState');
    } catch (err) {
      setRunsError(err instanceof Error ? err.message : 'providerState JSON 格式不正确');
      return;
    }
    if (!confirm(`对账「${runsTarget.title}」的 provider 状态吗？`)) return;
    setReconcilingRunId(run.id);
    setRunsError('');
    try {
      await apiRequest(
        `POST:/resource-requests/${runsTarget.id}/provisioning-runs/${run.id}/reconcile-provider-state`,
        { providerState },
      );
      await Promise.all([refreshRequests(), loadProvisioningRuns(runsTarget), loadRunSupervisor()]);
    } catch (err) {
      setRunsError(err instanceof Error ? err.message : 'provider 状态对账失败');
    } finally {
      setReconcilingRunId(null);
    }
  });

  const recoverStaleProvisioningRuns = usePersistFn(async () => {
    if (!confirm('恢复本团队超时未结束的外部交付运行吗？')) return;
    setRecoveringStaleRuns(true);
    setSupervisorError('');
    try {
      await apiRequest('POST:/resource-requests/provisioning-runs/recover-stale', {
        limit: 20,
        staleAfterSeconds: String(runSupervisor?.staleAfterSeconds || 1800),
      });
      await Promise.all([
        refreshRequests(),
        loadRunSupervisor(),
        runsTarget ? loadProvisioningRuns(runsTarget) : Promise.resolve(),
      ]);
    } catch (err) {
      setSupervisorError(err instanceof Error ? err.message : '恢复超时运行失败');
    } finally {
      setRecoveringStaleRuns(false);
    }
  });

  const processNextQueuedProvisioningRun = usePersistFn(async () => {
    if (!confirm('处理本团队下一条可用的外部交付队列运行吗？')) return;
    setProcessingQueuedRun(true);
    setSupervisorError('');
    try {
      await apiRequest('POST:/resource-requests/provisioning-runs/process-next', {});
      await Promise.all([
        refreshRequests(),
        loadRunSupervisor(),
        runsTarget ? loadProvisioningRuns(runsTarget) : Promise.resolve(),
      ]);
    } catch (err) {
      setSupervisorError(err instanceof Error ? err.message : '处理队列运行失败');
    } finally {
      setProcessingQueuedRun(false);
    }
  });

  const closeRuns = usePersistFn(() => setRunsTarget(null));

  return {
    runsTarget,
    provisioningRuns,
    runsLoading,
    runsError,
    replayingRunId,
    reconcilingRunId,
    runSupervisor,
    supervisorError,
    recoveringStaleRuns,
    processingQueuedRun,
    openProvisioningRuns,
    replayProvisioningRun,
    reconcileProviderProvisioningRun,
    recoverStaleProvisioningRuns,
    processNextQueuedProvisioningRun,
    closeRuns,
  };
}
