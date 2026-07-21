/**
 * 站点 live/审批操作 Hook
 *
 * 单一职责：站点 live sync、TLS 续期和回滚等需要确认/审批的 action flow。
 * 确认通过 pendingLiveAction 状态 + ConfirmDialog（页面层渲染）完成，
 * 成功/失败反馈统一走 feedback。
 */

import { useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import type { Site, SiteSyncPlan, SiteSyncRun } from '../types';

/** 待确认的 live/审批操作（由页面层 ConfirmDialog 承接）。 */
export type SiteLivePendingAction =
  | { kind: 'sync'; site: Site }
  | { kind: 'tlsRenew'; site: Site }
  | { kind: 'rollback'; site: Site; run: SiteSyncRun };

interface UseSiteLiveActionsArgs {
  queueSiteRuns: boolean;
  setPlans: Dispatch<SetStateAction<Record<string, SiteSyncPlan>>>;
  loadData: () => Promise<void>;
}

export function useSiteLiveActions(args: UseSiteLiveActionsArgs) {
  const { queueSiteRuns, setPlans, loadData } = args;
  const t = useTranslations('sites');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [renewingTlsId, setRenewingTlsId] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [pendingLiveAction, setPendingLiveAction] = useState<SiteLivePendingAction | null>(null);

  const runSyncLive = usePersistFn(async (site: Site) => {
    setSyncingId(site.id);
    try {
      const plan = await apiRequest<SiteSyncPlan>(`POST:/sites/${site.id}/sync-plan`, {
        dryRun: false,
        queue: queueSiteRuns,
        confirmationText: site.name,
      });
      setPlans((cur) => ({ ...cur, [site.id]: plan }));
      if (plan.status === 'blocked' && plan.approval) feedback.success(t('syncApprovalCreated'));
      await loadData();
    } catch (error) {
      console.error('Failed to sync site:', error);
      feedback.error(t('syncRequestFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSyncingId(null);
    }
  });

  const runTlsRenew = usePersistFn(async (site: Site, dryRun: boolean) => {
    setRenewingTlsId(site.id);
    try {
      const plan = await apiRequest<SiteSyncPlan>(`POST:/sites/${site.id}/tls-renew`, {
        dryRun,
        queue: queueSiteRuns,
        confirmationText: dryRun ? undefined : site.name,
      });
      setPlans((cur) => ({ ...cur, [site.id]: plan }));
      if (plan.status === 'blocked' && plan.approval)
        feedback.success(t('tlsRenewApprovalCreated'));
      await loadData();
    } catch (error) {
      console.error('Failed to renew site TLS certificate:', error);
      feedback.error(t('tlsRenewRequestFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRenewingTlsId(null);
    }
  });

  const runRollback = usePersistFn(async (site: Site, run: SiteSyncRun) => {
    setRollingBackId(run.id);
    try {
      const plan = await apiRequest<SiteSyncPlan>(
        `POST:/sites/${site.id}/sync-runs/${run.id}/rollback`,
        {
          dryRun: false,
          queue: queueSiteRuns,
          confirmationText: site.name,
        },
      );
      setPlans((cur) => ({ ...cur, [site.id]: plan }));
      if (plan.status === 'blocked' && plan.approval)
        feedback.success(t('rollbackApprovalCreated'));
      await loadData();
    } catch (error) {
      console.error('Failed to rollback site:', error);
      feedback.error(t('rollbackRequestFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRollingBackId(null);
    }
  });

  const handleSyncLive = usePersistFn((site: Site) => {
    setPendingLiveAction({ kind: 'sync', site });
  });

  const handleTlsRenew = usePersistFn((site: Site, dryRun: boolean) => {
    // dryRun 无需确认，直接执行；正式续期走 ConfirmDialog 二次确认
    if (dryRun) return runTlsRenew(site, true);
    setPendingLiveAction({ kind: 'tlsRenew', site });
  });

  const handleRollback = usePersistFn((site: Site, run: SiteSyncRun) => {
    setPendingLiveAction({ kind: 'rollback', site, run });
  });

  const cancelPendingLiveAction = usePersistFn(() => setPendingLiveAction(null));

  const confirmPendingLiveAction = usePersistFn(async () => {
    const action = pendingLiveAction;
    if (!action) return;
    if (action.kind === 'sync') await runSyncLive(action.site);
    else if (action.kind === 'tlsRenew') await runTlsRenew(action.site, false);
    else await runRollback(action.site, action.run);
  });

  return {
    syncingId,
    renewingTlsId,
    rollingBackId,
    pendingLiveAction,
    handleSyncLive,
    handleTlsRenew,
    handleRollback,
    cancelPendingLiveAction,
    confirmPendingLiveAction,
  };
}
