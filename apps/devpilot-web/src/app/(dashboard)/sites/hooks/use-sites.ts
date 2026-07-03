/**
 * 站点数据 Hook
 *
 * 单一职责：加载站点/服务器/项目/环境/代理配置/同步运行，管理 plans/syncRuns/takeover 状态。
 * 站点操作（plan/sync/tls/rollback）委托 use-site-actions。
 */

import { useEffect, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
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
  const [sites, setSites] = useState<Site[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectEnvironments, setProjectEnvironments] = useState<ProjectEnvironment[]>([]);
  const [proxyConfigs, setProxyConfigs] = useState<ProxyConfig[]>([]);
  const [plans, setPlans] = useState<Record<string, SiteSyncPlan>>({});
  const [syncRuns, setSyncRuns] = useState<Record<string, SiteSyncRun[]>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(openCreateOnMount);
  const [queueSiteRuns, setQueueSiteRuns] = useState(false);

  const refreshSyncRuns = usePersistFn(async (id: string) => {
    const runs = await apiRequest<SiteSyncRun[]>(`GET:/sites/${id}/sync-runs`);
    setSyncRuns((cur) => ({ ...cur, [id]: runs }));
  });

  const loadData = usePersistFn(async () => {
    setLoading(true);
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
    } catch (error) {
      console.error('Failed to load sites:', error);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    loadData();
  }, [loadData, siteId]);

  const handleDelete = usePersistFn(async (id: string) => {
    if (!confirm('确定要删除这个站点吗？')) return;
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
    } catch (error) {
      console.error('Failed to delete site:', error);
      alert(error instanceof Error ? error.message : '删除站点失败');
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
    showModal,
    setShowModal,
    queueSiteRuns,
    setQueueSiteRuns,
    handleDelete,
    ...takeover,
    ...actions,
    reload: loadData,
  };
}

export { readRecord };
