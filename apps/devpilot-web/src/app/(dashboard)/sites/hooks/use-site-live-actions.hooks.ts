/**
 * 站点 live/审批操作 Hook
 *
 * 单一职责：站点 live sync、TLS 续期和回滚等需要确认/审批的 action flow。
 */

import { useState, type Dispatch, type SetStateAction } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { Site, SiteSyncPlan, SiteSyncRun } from '../types';

interface UseSiteLiveActionsArgs {
  queueSiteRuns: boolean;
  setPlans: Dispatch<SetStateAction<Record<string, SiteSyncPlan>>>;
  loadData: () => Promise<void>;
}

export function useSiteLiveActions(args: UseSiteLiveActionsArgs) {
  const { queueSiteRuns, setPlans, loadData } = args;
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [renewingTlsId, setRenewingTlsId] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

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
        },
      );
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
    syncingId,
    renewingTlsId,
    rollingBackId,
    handleSyncLive,
    handleTlsRenew,
    handleRollback,
  };
}
