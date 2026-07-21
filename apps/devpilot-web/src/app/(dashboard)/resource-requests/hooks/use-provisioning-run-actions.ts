import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { usePollingList } from '@/hooks/use-polling-list';
import type {
  ResourceProvisioningRun,
  ResourceProvisioningRunSupervisor,
  ResourceRequest,
} from '../types';
import { parseJsonObject } from '../utils';

/** 供给运行是否处于"运行中"：存在任意 active 运行时保持 5s 轮询。 */
const isActiveProvisioningRun = (run: ResourceProvisioningRun) =>
  ['queued', 'running', 'pending'].includes(run.status || '');

/** 待确认的交付运行操作（由页面层 ConfirmDialog 承接）。 */
export type PendingProvisioningAction =
  | { kind: 'replay'; run: ResourceProvisioningRun }
  | { kind: 'reconcile'; run: ResourceProvisioningRun; providerState: Record<string, unknown> }
  | { kind: 'recoverStale' }
  | { kind: 'processNext' };

interface ProvisioningRunActionOptions {
  refreshRequests: () => Promise<void>;
}

export function useProvisioningRunActions({ refreshRequests }: ProvisioningRunActionOptions) {
  const t = useTranslations('resourceRequests');
  const [runsTarget, setRunsTarget] = useState<ResourceRequest | null>(null);
  // supervisor 摘要包装为单元素列表接入 usePollingList：存在 queued/running 供给运行时保持 5s 轮询。
  const supervisorSWR = usePollingList<ResourceProvisioningRunSupervisor>(
    'GET:/resource-requests/provisioning-runs/supervisor',
    async () => [
      await apiRequest<ResourceProvisioningRunSupervisor>(
        'GET:/resource-requests/provisioning-runs/supervisor',
      ),
    ],
    {
      isActive: (s) => (s.counts?.queued ?? 0) + (s.counts?.running ?? 0) > 0,
      interval: 5000,
    },
  );
  // 当前打开的运行记录列表：key 随 runsTarget 条件启用，关闭弹窗（null）即停止请求与轮询。
  const runsSWR = usePollingList<ResourceProvisioningRun>(
    runsTarget ? `GET:/resource-requests/${runsTarget.id}/provisioning-runs` : null,
    () =>
      apiRequest<ResourceProvisioningRun[]>(
        `GET:/resource-requests/${runsTarget?.id}/provisioning-runs`,
      ),
    { isActive: isActiveProvisioningRun, interval: 5000 },
  );
  const provisioningRuns = useMemo(() => runsSWR.data ?? [], [runsSWR.data]);
  const runSupervisor = supervisorSWR.data?.[0] ?? null;
  const [runsActionError, setRunsActionError] = useState('');
  const [supervisorActionError, setSupervisorActionError] = useState('');
  const [replayingRunId, setReplayingRunId] = useState<string | null>(null);
  const [reconcilingRunId, setReconcilingRunId] = useState<string | null>(null);
  const [recoveringStaleRuns, setRecoveringStaleRuns] = useState(false);
  const [processingQueuedRun, setProcessingQueuedRun] = useState(false);
  const [pendingRunAction, setPendingRunAction] = useState<PendingProvisioningAction | null>(null);

  // GET 失败由 SWR error 暴露；这里吞掉异常仅保证动作流程不中断，成功后清掉动作错误。
  const refreshRunSupervisor = usePersistFn(async () => {
    try {
      await supervisorSWR.mutate();
      setSupervisorActionError('');
    } catch {
      /* supervisorSWR.error 已携带原因 */
    }
  });

  const refreshProvisioningRuns = usePersistFn(async () => {
    try {
      await runsSWR.mutate();
    } catch {
      /* runsSWR.error 已携带原因 */
    }
  });

  const openProvisioningRuns = usePersistFn(async (request: ResourceRequest) => {
    setRunsActionError('');
    setRunsTarget(request);
  });

  const runReplay = usePersistFn(async (run: ResourceProvisioningRun) => {
    if (!runsTarget) return;
    setReplayingRunId(run.id);
    setRunsActionError('');
    try {
      await apiRequest(
        `POST:/resource-requests/${runsTarget.id}/provisioning-runs/${run.id}/replay`,
      );
      await Promise.all([refreshRequests(), refreshProvisioningRuns()]);
    } catch (err) {
      setRunsActionError(err instanceof Error ? err.message : t('replayRunFailed'));
    } finally {
      setReplayingRunId(null);
    }
  });

  const runReconcile = usePersistFn(
    async (run: ResourceProvisioningRun, providerState: Record<string, unknown>) => {
      if (!runsTarget) return;
      setReconcilingRunId(run.id);
      setRunsActionError('');
      try {
        await apiRequest(
          `POST:/resource-requests/${runsTarget.id}/provisioning-runs/${run.id}/reconcile-provider-state`,
          { providerState },
        );
        await Promise.all([refreshRequests(), refreshProvisioningRuns(), refreshRunSupervisor()]);
      } catch (err) {
        setRunsActionError(err instanceof Error ? err.message : t('reconcileFailed'));
      } finally {
        setReconcilingRunId(null);
      }
    },
  );

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
        runsTarget ? refreshProvisioningRuns() : Promise.resolve(),
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
        runsTarget ? refreshProvisioningRuns() : Promise.resolve(),
      ]);
    } catch (err) {
      setSupervisorActionError(err instanceof Error ? err.message : t('processNextFailed'));
    } finally {
      setProcessingQueuedRun(false);
    }
  });

  // 以下四个入口只负责"收集参数 + 发起确认"，实际执行统一走 confirmPendingRunAction
  const replayProvisioningRun = usePersistFn((run: ResourceProvisioningRun) => {
    if (!runsTarget) return;
    setPendingRunAction({ kind: 'replay', run });
  });

  const reconcileProviderProvisioningRun = usePersistFn((run: ResourceProvisioningRun) => {
    if (!runsTarget) return;
    const raw = window.prompt('粘贴 providerState JSON 对象');
    if (!raw) return;
    let providerState: Record<string, unknown>;
    try {
      providerState = parseJsonObject(raw, 'providerState');
    } catch (err) {
      setRunsActionError(err instanceof Error ? err.message : t('providerStateInvalid'));
      return;
    }
    setPendingRunAction({ kind: 'reconcile', run, providerState });
  });

  const recoverStaleProvisioningRuns = usePersistFn(() => {
    setPendingRunAction({ kind: 'recoverStale' });
  });

  const processNextQueuedProvisioningRun = usePersistFn(() => {
    setPendingRunAction({ kind: 'processNext' });
  });

  const cancelPendingRunAction = usePersistFn(() => setPendingRunAction(null));

  const confirmPendingRunAction = usePersistFn(async () => {
    const action = pendingRunAction;
    if (!action) return;
    if (action.kind === 'replay') await runReplay(action.run);
    else if (action.kind === 'reconcile') await runReconcile(action.run, action.providerState);
    else if (action.kind === 'recoverStale') await runRecoverStale();
    else await runProcessNext();
  });

  const closeRuns = usePersistFn(() => setRunsTarget(null));

  // 动作错误与轮询期间的 SWR GET 错误合并为一个 string，保持原有导出语义。
  const runsError = runsActionError || (runsSWR.error ? runsSWR.error.message : '');
  const supervisorError =
    supervisorActionError || (supervisorSWR.error ? supervisorSWR.error.message : '');

  return {
    runsTarget,
    provisioningRuns,
    // isLoading 仅在首次（或切换目标后）无数据拉取时为 true；后台轮询不触发 loading 闪烁。
    runsLoading: runsSWR.isLoading,
    runsError,
    replayingRunId,
    reconcilingRunId,
    runSupervisor,
    supervisorError,
    recoveringStaleRuns,
    processingQueuedRun,
    pendingRunAction,
    openProvisioningRuns,
    replayProvisioningRun,
    reconcileProviderProvisioningRun,
    recoverStaleProvisioningRuns,
    processNextQueuedProvisioningRun,
    cancelPendingRunAction,
    confirmPendingRunAction,
    closeRuns,
  };
}
