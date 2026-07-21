/**
 * 站点操作 Hook
 *
 * 单一职责：站点同步计划、live 同步、诊断、OpenResty 探测、TLS 探测/续期、回滚。
 * 拆出独立文件以保持 use-sites.ts <200 行。
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import type { Site, SiteSyncPlan } from '../types';
import { useSiteLiveActions } from './use-site-live-actions.hooks';

interface UseSiteActionsArgs {
  queueSiteRuns: boolean;
  setPlans: React.Dispatch<React.SetStateAction<Record<string, SiteSyncPlan>>>;
  refreshSyncRuns: (siteId: string) => Promise<void>;
  loadData: () => Promise<void>;
}

export function useSiteActions(args: UseSiteActionsArgs) {
  const { queueSiteRuns, setPlans, refreshSyncRuns, loadData } = args;
  const t = useTranslations('sites');
  const [planningId, setPlanningId] = useState<string | null>(null);
  const [diagnosingId, setDiagnosingId] = useState<string | null>(null);
  const [checkingModuleBaselineId, setCheckingModuleBaselineId] = useState<string | null>(null);
  const [probingModulesId, setProbingModulesId] = useState<string | null>(null);
  const [probingRuntimeId, setProbingRuntimeId] = useState<string | null>(null);
  const [smokingId, setSmokingId] = useState<string | null>(null);
  const [probingTlsId, setProbingTlsId] = useState<string | null>(null);
  const liveActions = useSiteLiveActions({ queueSiteRuns, setPlans, loadData });

  const runPlanAction = usePersistFn(
    async (
      site: Site,
      endpoint: string,
      body: Record<string, unknown>,
      setState: (id: string | null) => void,
      errorMsg: string,
      reloadAll = false,
    ) => {
      setState(site.id);
      try {
        const plan = await apiRequest<SiteSyncPlan>(`POST:/sites/${site.id}/${endpoint}`, body);
        setPlans((cur) => ({ ...cur, [site.id]: plan }));
        if (reloadAll) await loadData();
        else await refreshSyncRuns(site.id);
      } catch (error) {
        console.error(errorMsg, error);
        feedback.error(errorMsg, {
          description: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setState(null);
      }
    },
  );

  const handleCreatePlan = usePersistFn((siteId: string) =>
    runPlanAction(
      { id: siteId } as Site,
      'sync-plan',
      { dryRun: true, queue: queueSiteRuns },
      setPlanningId,
      t('createPlanFailed'),
    ),
  );
  const handleDiagnostics = usePersistFn((site: Site) =>
    runPlanAction(
      site,
      'diagnostics',
      { dryRun: false, queue: queueSiteRuns, tailLines: 200 },
      setDiagnosingId,
      t('diagnosticsFailed'),
    ),
  );
  const handleOpenRestyStatus = usePersistFn((site: Site, dryRun = false) =>
    runPlanAction(
      site,
      'openresty-status',
      { dryRun, queue: queueSiteRuns },
      setProbingRuntimeId,
      t('openrestyStatusFailed'),
    ),
  );
  const handleOpenRestyModules = usePersistFn((site: Site, dryRun = false) =>
    runPlanAction(
      site,
      'openresty-modules',
      { dryRun, queue: queueSiteRuns },
      setProbingModulesId,
      t('openrestyModulesFailed'),
    ),
  );
  const handleOpenRestyModuleBaseline = usePersistFn((site: Site, dryRun = false) =>
    runPlanAction(
      site,
      'openresty-module-baseline',
      { dryRun, queue: queueSiteRuns },
      setCheckingModuleBaselineId,
      t('moduleBaselineFailed'),
    ),
  );
  const handleSmokeCheck = usePersistFn((site: Site, dryRun = false) =>
    runPlanAction(
      site,
      'smoke-check',
      { dryRun, queue: queueSiteRuns },
      setSmokingId,
      t('smokeCheckFailed'),
    ),
  );
  const handleTlsProbe = usePersistFn((site: Site) =>
    runPlanAction(
      site,
      'tls-probe',
      { dryRun: false, queue: queueSiteRuns },
      setProbingTlsId,
      t('tlsProbeFailed'),
      true,
    ),
  );
  const handleTlsProbePlan = usePersistFn((site: Site) =>
    runPlanAction(
      site,
      'tls-probe',
      { dryRun: true, queue: queueSiteRuns },
      setProbingTlsId,
      t('tlsProbePlanFailed'),
    ),
  );

  return {
    planningId,
    syncingId: liveActions.syncingId,
    diagnosingId,
    checkingModuleBaselineId,
    probingModulesId,
    probingRuntimeId,
    smokingId,
    probingTlsId,
    renewingTlsId: liveActions.renewingTlsId,
    rollingBackId: liveActions.rollingBackId,
    pendingLiveAction: liveActions.pendingLiveAction,
    handleCreatePlan,
    handleSyncLive: liveActions.handleSyncLive,
    handleDiagnostics,
    handleOpenRestyStatus,
    handleOpenRestyModules,
    handleOpenRestyModuleBaseline,
    handleSmokeCheck,
    handleTlsProbe,
    handleTlsProbePlan,
    handleTlsRenew: liveActions.handleTlsRenew,
    handleRollback: liveActions.handleRollback,
    cancelPendingLiveAction: liveActions.cancelPendingLiveAction,
    confirmPendingLiveAction: liveActions.confirmPendingLiveAction,
  };
}
