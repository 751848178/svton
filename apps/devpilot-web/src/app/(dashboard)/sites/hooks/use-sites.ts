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
  SiteTakeoverForm,
} from '../types';
import { createSiteTakeoverForm, buildSiteTakeoverTls } from '../utils-takeover';
import { readRecord } from '../utils';
import { useSiteActions } from './use-site-actions';

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
  const [focusedSiteId, setFocusedSiteId] = useState(siteId);
  const [takeoverForms, setTakeoverForms] = useState<Record<string, SiteTakeoverForm>>({});
  const [savingTakeoverId, setSavingTakeoverId] = useState<string | null>(null);
  const [activatingPreviewId, setActivatingPreviewId] = useState<string | null>(null);

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
    setFocusedSiteId(siteId);
  }, [loadData, siteId]);

  const focusedSite = focusedSiteId ? sites.find((s) => s.id === focusedSiteId) || null : null;
  useEffect(() => {
    if (!focusedSite) return;
    setTakeoverForms((cur) =>
      cur[focusedSite.id] ? cur : { ...cur, [focusedSite.id]: createSiteTakeoverForm(focusedSite) },
    );
  }, [focusedSite?.id]);

  const updateFocusedTakeoverForm = usePersistFn((patch: Partial<SiteTakeoverForm>) => {
    if (!focusedSite) return;
    setTakeoverForms((cur) => ({
      ...cur,
      [focusedSite.id]: {
        ...createSiteTakeoverForm(focusedSite),
        ...cur[focusedSite.id],
        ...patch,
      },
    }));
  });

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

  const handleSaveTakeoverBinding = usePersistFn(async (site: Site) => {
    const form = takeoverForms[site.id] || createSiteTakeoverForm(site);
    setSavingTakeoverId(site.id);
    try {
      const updated = await apiRequest<Site>(`PUT:/sites/${site.id}`, {
        serverId: form.serverId,
        tls: buildSiteTakeoverTls(site, form),
        status: site.status,
      });
      setSites((cur) => cur.map((i) => (i.id === updated.id ? updated : i)));
      setTakeoverForms((cur) => ({ ...cur, [updated.id]: createSiteTakeoverForm(updated) }));
      alert('已保存站点接管绑定');
    } catch (error) {
      console.error('Failed to save site takeover binding:', error);
      alert(error instanceof Error ? error.message : '保存站点接管绑定失败');
    } finally {
      setSavingTakeoverId(null);
    }
  });

  const handleActivatePreviewSite = usePersistFn(async (site: Site) => {
    const form = takeoverForms[site.id] || createSiteTakeoverForm(site);
    if (!form.serverId) {
      alert('请先选择目标服务器');
      return;
    }
    if (!form.upstreamUrl.trim()) {
      alert('请填写预览上游地址');
      return;
    }
    setActivatingPreviewId(site.id);
    try {
      const result = await apiRequest<{ site: Site; syncPlan?: SiteSyncPlan }>(
        `POST:/sites/${site.id}/preview-takeover`,
        {
          serverId: form.serverId,
          upstreamUrl: form.upstreamUrl.trim(),
          websocket: form.websocket,
          tls: buildSiteTakeoverTls(site, form),
          createDryRunPlan: true,
          queue: queueSiteRuns,
        },
      );
      setSites((cur) => cur.map((i) => (i.id === result.site.id ? result.site : i)));
      setTakeoverForms((cur) => ({
        ...cur,
        [result.site.id]: createSiteTakeoverForm(result.site),
      }));
      if (result.syncPlan) setPlans((cur) => ({ ...cur, [site.id]: result.syncPlan! }));
      await refreshSyncRuns(site.id);
    } catch (error) {
      console.error('Failed to activate preview site takeover:', error);
      alert(error instanceof Error ? error.message : '接管预览站点失败');
    } finally {
      setActivatingPreviewId(null);
    }
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
    focusedSiteId,
    setFocusedSiteId,
    takeoverForms,
    savingTakeoverId,
    activatingPreviewId,
    focusedSite,
    updateFocusedTakeoverForm,
    handleDelete,
    handleSaveTakeoverBinding,
    handleActivatePreviewSite,
    ...actions,
    reload: loadData,
  };
}

export { readRecord };
