/**
 * 站点操作 Hook
 *
 * 单一职责：站点同步计划、live 同步、诊断、OpenResty 探测、TLS 探测/续期、回滚。
 * 拆出独立文件以保持 use-sites.ts <200 行。
 */

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { Site, SiteSyncPlan, SiteSyncRun } from '../types';

interface UseSiteActionsArgs {
  queueSiteRuns: boolean;
  setPlans: React.Dispatch<React.SetStateAction<Record<string, SiteSyncPlan>>>;
  refreshSyncRuns: (siteId: string) => Promise<void>;
  loadData: () => Promise<void>;
}

export function useSiteActions(args: UseSiteActionsArgs) {
  const { queueSiteRuns, setPlans, refreshSyncRuns, loadData } = args;
  const [planningId, setPlanningId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [diagnosingId, setDiagnosingId] = useState<string | null>(null);
  const [checkingModuleBaselineId, setCheckingModuleBaselineId] = useState<string | null>(null);
  const [probingModulesId, setProbingModulesId] = useState<string | null>(null);
  const [probingRuntimeId, setProbingRuntimeId] = useState<string | null>(null);
  const [smokingId, setSmokingId] = useState<string | null>(null);
  const [probingTlsId, setProbingTlsId] = useState<string | null>(null);
  const [renewingTlsId, setRenewingTlsId] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

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
  const handleSyncLive = usePersistFn(async (site: Site) => {
    if (!confirm(`将申请同步 Nginx/OpenResty 站点配置：${site.name}，确认继续吗？`)) return;
    setSyncingId(site.id);
    try {
      const plan = await apiRequest<SiteSyncPlan>(`POST:/sites/${site.id}/sync-plan`, {
        dryRun: false,
        queue: queueSiteRuns,
        confirmationText: site.name,
      });
      setPlans((cur) => ({ ...cur, [site.id]: plan }));
      if (plan.status === 'blocked' && plan.approval)
        alert('已生成站点同步审批单，可在操作审批页面批准后执行');
      await loadData();
    } catch (error) {
      console.error('Failed to sync site:', error);
      alert(error instanceof Error ? error.message : '申请站点同步失败');
    } finally {
      setSyncingId(null);
    }
  });
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

  const handleTlsRenew = usePersistFn(async (site: Site, dryRun: boolean) => {
    if (!dryRun && !confirm(`将申请续期 TLS 证书：${site.name}，确认继续吗？`)) return;
    setRenewingTlsId(site.id);
    try {
      const plan = await apiRequest<SiteSyncPlan>(`POST:/sites/${site.id}/tls-renew`, {
        dryRun,
        queue: queueSiteRuns,
        confirmationText: dryRun ? undefined : site.name,
      });
      setPlans((cur) => ({ ...cur, [site.id]: plan }));
      if (plan.status === 'blocked' && plan.approval)
        alert('已生成证书续期审批单，可在操作审批页面批准后执行');
      await loadData();
    } catch (error) {
      console.error('Failed to renew site TLS certificate:', error);
      alert(error instanceof Error ? error.message : '申请站点 TLS 证书续期失败');
    } finally {
      setRenewingTlsId(null);
    }
  });

  const handleRollback = usePersistFn(async (site: Site, run: SiteSyncRun) => {
    if (!confirm(`将申请把 ${site.name} 回滚到指定时间的 Nginx 配置，确认继续吗？`)) return;
    setRollingBackId(run.id);
    try {
      const plan = await apiRequest<SiteSyncPlan>(
        `POST:/sites/${site.id}/sync-runs/${run.id}/rollback`,
        {
        dryRun: false,
        queue: queueSiteRuns,
        confirmationText: site.name,
      });
      setPlans((cur) => ({ ...cur, [site.id]: plan }));
      if (plan.status === 'blocked' && plan.approval)
        alert('已生成站点回滚审批单，可在操作审批页面批准后执行');
      await loadData();
    } catch (error) {
      console.error('Failed to rollback site:', error);
      alert(error instanceof Error ? error.message : '申请回滚站点配置失败');
    } finally {
      setRollingBackId(null);
    }
  });

  return {
    planningId,
    syncingId,
    diagnosingId,
    checkingModuleBaselineId,
    probingModulesId,
    probingRuntimeId,
    smokingId,
    probingTlsId,
    renewingTlsId,
    rollingBackId,
    handleCreatePlan,
    handleSyncLive,
    handleDiagnostics,
    handleOpenRestyStatus,
    handleOpenRestyModules,
    handleOpenRestyModuleBaseline,
    handleSmokeCheck,
    handleTlsProbe,
    handleTlsProbePlan,
    handleTlsRenew,
    handleRollback,
  };
}
