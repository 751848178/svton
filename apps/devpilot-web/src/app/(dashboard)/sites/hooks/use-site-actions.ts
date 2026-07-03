/**
 * 站点操作 Hook
 *
 * 单一职责：站点同步计划、live 同步、诊断、OpenResty 探测、TLS 探测/续期、回滚。
 * 拆出独立文件以保持 use-sites.ts <200 行。
 */

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
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
        alert(error instanceof Error ? error.message : errorMsg);
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
      '生成站点同步计划失败',
    ),
  );
  const handleDiagnostics = usePersistFn((site: Site) =>
    runPlanAction(
      site,
      'diagnostics',
      { dryRun: false, queue: queueSiteRuns, tailLines: 200 },
      setDiagnosingId,
      '执行站点诊断失败',
    ),
  );
  const handleOpenRestyStatus = usePersistFn((site: Site, dryRun = false) =>
    runPlanAction(
      site,
      'openresty-status',
      { dryRun, queue: queueSiteRuns },
      setProbingRuntimeId,
      '探测 OpenResty/Nginx 运行态失败',
    ),
  );
  const handleOpenRestyModules = usePersistFn((site: Site, dryRun = false) =>
    runPlanAction(
      site,
      'openresty-modules',
      { dryRun, queue: queueSiteRuns },
      setProbingModulesId,
      '盘点 OpenResty/Nginx 模块失败',
    ),
  );
  const handleOpenRestyModuleBaseline = usePersistFn((site: Site, dryRun = false) =>
    runPlanAction(
      site,
      'openresty-module-baseline',
      { dryRun, queue: queueSiteRuns },
      setCheckingModuleBaselineId,
      '检查 OpenResty/Nginx 模块基线失败',
    ),
  );
  const handleSmokeCheck = usePersistFn((site: Site, dryRun = false) =>
    runPlanAction(
      site,
      'smoke-check',
      { dryRun, queue: queueSiteRuns },
      setSmokingId,
      '执行站点 Smoke 检查失败',
    ),
  );
  const handleTlsProbe = usePersistFn((site: Site) =>
    runPlanAction(
      site,
      'tls-probe',
      { dryRun: false, queue: queueSiteRuns },
      setProbingTlsId,
      '探测站点 TLS 证书失败',
      true,
    ),
  );
  const handleTlsProbePlan = usePersistFn((site: Site) =>
    runPlanAction(
      site,
      'tls-probe',
      { dryRun: true, queue: queueSiteRuns },
      setProbingTlsId,
      '生成站点 TLS 探测计划失败',
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
  };
}
