/**
 * 站点数据 Hook
 *
 * 单一职责：加载站点/服务器/项目/环境/代理配置/同步运行，管理 plans/syncRuns/takeover 状态。
 * 站点操作（plan/sync/tls/rollback）委托 use-site-actions。
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import { usePollingList } from '@/hooks/use-polling-list';
import type {
  Site,
  Server,
  Project,
  ProjectEnvironment,
  ProxyConfig,
  SiteSyncPlan,
  SiteSyncRun,
} from '../types';
import { readRecord } from '../utils';
import { useSiteActions } from './use-site-actions';
import { useSiteTakeover } from './use-site-takeover.hooks';

export function useSites(
  projectId: string,
  environmentId: string,
  siteId: string,
  openCreateOnMount: boolean,
) {
  const t = useTranslations('sites');
  const [sites, setSites] = useState<Site[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectEnvironments, setProjectEnvironments] = useState<ProjectEnvironment[]>([]);
  const [proxyConfigs, setProxyConfigs] = useState<ProxyConfig[]>([]);
  const [plans, setPlans] = useState<Record<string, SiteSyncPlan>>({});
  const [syncRuns, setSyncRuns] = useState<Record<string, SiteSyncRun[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);
  const [showModal, setShowModal] = useState(openCreateOnMount);
  const [queueSiteRuns, setQueueSiteRuns] = useState(false);
  const [editTarget, setEditTarget] = useState<Site | null>(null);

  const refreshSyncRuns = usePersistFn(async (id: string) => {
    const runs = await apiRequest<SiteSyncRun[]>(`GET:/sites/${id}/sync-runs`);
    setSyncRuns((cur) => ({ ...cur, [id]: runs }));
  });

  const loadData = usePersistFn(async () => {
    setLoading(true);
    setError('');
    try {
      const siteParams = {
        ...(projectId ? { projectId } : {}),
        ...(environmentId ? { environmentId } : {}),
      };
      const [siteData, serverData, projectData, envData, proxyData] = await Promise.all([
        apiRequest<Site[]>(
          'GET:/sites',
          Object.keys(siteParams).length > 0 ? siteParams : undefined,
        ),
        apiRequest<Server[]>('GET:/servers'),
        apiRequest<Project[]>('GET:/projects'),
        apiRequest<ProjectEnvironment[]>('GET:/project-environments'),
        apiRequest<ProxyConfig[]>('GET:/proxy-configs'),
      ]);
      setSites(siteData);
      setServers(serverData);
      setProjects(projectData);
      setProjectEnvironments(envData);
      setProxyConfigs(proxyData);
      if (siteData.length > 0) {
        const entries = await Promise.all(
          siteData.map(
            async (s) =>
              [s.id, await apiRequest<SiteSyncRun[]>(`GET:/sites/${s.id}/sync-runs`)] as const,
          ),
        );
        setSyncRuns(Object.fromEntries(entries));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadFailed'));
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    loadData();
  }, [loadData, siteId]);

  // sync-runs 轮询：存在 queued/running 状态的运行时，每 5s 刷新对应站点的运行记录。
  // 复用共享 usePollingList（SWR 包装）：数据内有 active 项才保持轮询，全部终态后自动停止。
  const activeSyncRunSiteIds = Object.entries(syncRuns)
    .filter(([, runs]) =>
      runs.some((run) => run.status === 'queued' || run.status === 'running'),
    )
    .map(([id]) => id)
    .sort();

  const activeRunsSWR = usePollingList<readonly [string, SiteSyncRun[]]>(
    activeSyncRunSiteIds.length > 0
      ? `sites-sync-runs-active:${activeSyncRunSiteIds.join(',')}`
      : null,
    () =>
      Promise.all(
        activeSyncRunSiteIds.map(
          async (id) =>
            [id, await apiRequest<SiteSyncRun[]>(`GET:/sites/${id}/sync-runs`)] as const,
        ),
      ),
    {
      isActive: ([, runs]) =>
        runs.some((run) => run.status === 'queued' || run.status === 'running'),
      interval: 5000,
    },
  );

  useEffect(() => {
    const entries = activeRunsSWR.data;
    if (!entries) return;
    setSyncRuns((cur) => ({ ...cur, ...Object.fromEntries(entries) }));
  }, [activeRunsSWR.data]);

  const handleDelete = usePersistFn((id: string) => {
    setDeleteTarget(sites.find((s) => s.id === id) ?? null);
  });

  const cancelDelete = usePersistFn(() => {
    setDeleteTarget(null);
  });

  const confirmDelete = usePersistFn(async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await apiRequest(`DELETE:/sites/${id}`);
      setSites((cur) => cur.filter((s) => s.id !== id));
      setPlans((cur) => {
        const n = { ...cur };
        delete n[id];
        return n;
      });
      setSyncRuns((cur) => {
        const n = { ...cur };
        delete n[id];
        return n;
      });
      setDeleteTarget(null);
      feedback.success(t('deleteSuccess'));
    } catch (error) {
      feedback.error(t('deleteFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  });

  const takeover = useSiteTakeover({
    sites,
    siteId,
    queueSiteRuns,
    setSites,
    setPlans,
    refreshSyncRuns,
  });

  const actions = useSiteActions({ queueSiteRuns, setPlans, refreshSyncRuns, loadData });

  return {
    sites,
    servers,
    projects,
    projectEnvironments,
    proxyConfigs,
    plans,
    syncRuns,
    loading,
    error,
    deleteTarget,
    showModal,
    setShowModal,
    editTarget,
    setEditTarget,
    queueSiteRuns,
    setQueueSiteRuns,
    handleDelete,
    cancelDelete,
    confirmDelete,
    ...takeover,
    ...actions,
    reload: loadData,
  };
}

export { readRecord };
