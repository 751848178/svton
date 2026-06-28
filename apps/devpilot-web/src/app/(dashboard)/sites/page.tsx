'use client';

import { createElement, Suspense as ReactSuspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function SuspenseBoundary({ children, fallback }: { children: ReactNode; fallback: ReactNode }): any {
  return createElement(ReactSuspense as any, { fallback }, children);
}

type SiteRuntimeType = 'reverse_proxy' | 'static' | 'docker' | 'runtime';

interface Site {
  id: string;
  name: string;
  primaryDomain: string;
  aliases: unknown;
  runtimeType: SiteRuntimeType;
  runtimeConfig: unknown;
  tls: unknown;
  accessPolicy: unknown;
  status: string;
  lastSyncAt: string | null;
  syncError: string | null;
  createdAt: string;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  server?: { id: string; name: string; host: string; status: string } | null;
  proxyConfig?: { id: string; name: string; domain: string; status: string } | null;
}

interface Server {
  id: string;
  name: string;
  host: string;
  status: string;
}

interface Project {
  id: string;
  name: string;
}

interface ProjectEnvironment {
  id: string;
  projectId: string;
  key: string;
  name: string;
  status: string;
}

interface ProxyConfig {
  id: string;
  name: string;
  domain: string;
  status: string;
}

interface SitePlanStep {
  key: string;
  label: string;
  command: string;
  required: boolean;
  preview?: string;
}

interface SiteSyncPlan {
  mode: string;
  status: string;
  executorKey: string;
  adapterKey: string;
  executable: boolean;
  warnings: string[];
  commandPlan: SitePlanStep[];
  error?: string | null;
  nginxConfig: string;
  target: {
    serverId?: string | null;
    serverName?: string;
    serverHost?: string;
    configPath?: string;
    runtimeType?: string;
  };
  syncRun?: SiteSyncRun;
  approval?: { id: string; status: string; risk: string } | null;
  configDiff?: SiteConfigDiff | null;
  logs?: unknown;
  result?: unknown;
}

interface SiteConfigDiff {
  sourceRunId?: string | null;
  hasBaseline: boolean;
  hasChanges: boolean;
  added: number;
  removed: number;
  unchanged: number;
  summary: string;
  unifiedDiff: string;
}

interface SiteSyncRun {
  id: string;
  mode: string;
  trigger: string;
  dryRun: boolean;
  status: string;
  operationApprovalId?: string | null;
  serverExecutionJobId?: string | null;
  serverExecutionJob?: {
    id: string;
    status: string;
    queueMode: string;
    attempt: number;
    maxAttempts: number;
    queuedAt: string;
    startedAt?: string | null;
    finishedAt?: string | null;
  } | null;
  targetConfigPath?: string | null;
  configDiff?: SiteConfigDiff | null;
  logs?: unknown;
  result?: unknown;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  sourceRunId?: string | null;
  sourceRun?: {
    id: string;
    mode: string;
    status: string;
    dryRun: boolean;
    startedAt: string;
    targetConfigPath?: string | null;
  } | null;
  operationApproval?: { id: string; status: string; risk: string; reviewedAt?: string | null; consumedAt?: string | null } | null;
  actor?: { id: string; name?: string | null; email?: string | null } | null;
}

interface SiteTakeoverForm {
  serverId: string;
  upstreamUrl: string;
  websocket: boolean;
  tlsEnabled: boolean;
  tlsType: string;
  tlsEmail: string;
  tlsCertName: string;
  tlsAssetId: string;
}

interface PreviewSiteTakeoverResult {
  site: Site;
  syncPlan?: SiteSyncPlan | null;
}

const runtimeTypeLabels: Record<SiteRuntimeType, string> = {
  reverse_proxy: '反向代理',
  static: '静态站点',
  docker: 'Docker 服务',
  runtime: '运行时服务',
};

function SitesContent() {
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<Site[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectEnvironments, setProjectEnvironments] = useState<ProjectEnvironment[]>([]);
  const [proxyConfigs, setProxyConfigs] = useState<ProxyConfig[]>([]);
  const [plans, setPlans] = useState<Record<string, SiteSyncPlan>>({});
  const [syncRuns, setSyncRuns] = useState<Record<string, SiteSyncRun[]>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [queueSiteRuns, setQueueSiteRuns] = useState(false);
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
  const [focusedSiteId, setFocusedSiteId] = useState('');
  const [takeoverForms, setTakeoverForms] = useState<Record<string, SiteTakeoverForm>>({});
  const [savingTakeoverId, setSavingTakeoverId] = useState<string | null>(null);
  const [activatingPreviewId, setActivatingPreviewId] = useState<string | null>(null);
  const projectId = searchParams.get('projectId') || '';
  const environmentId = searchParams.get('environmentId') || '';
  const siteId = searchParams.get('siteId') || '';

  useEffect(() => {
    loadData();
    setFocusedSiteId(siteId);
    if (searchParams.get('new') === 'true') {
      setShowModal(true);
    }
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const siteParams = {
        ...(projectId ? { projectId } : {}),
        ...(environmentId ? { environmentId } : {}),
      };
      const [siteData, serverData, projectData, environmentData, proxyData] = await Promise.all([
        api.get<Site[]>('/sites', Object.keys(siteParams).length > 0 ? { params: siteParams } : undefined),
        api.get<Server[]>('/servers'),
        api.get<Project[]>('/projects'),
        api.get<ProjectEnvironment[]>('/project-environments'),
        api.get<ProxyConfig[]>('/proxy-configs'),
      ]);
      setSites(siteData);
      setServers(serverData);
      setProjects(projectData);
      setProjectEnvironments(environmentData);
      setProxyConfigs(proxyData);
      await loadSyncRuns(siteData);
    } catch (error) {
      console.error('Failed to load sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncRuns = async (siteData: Site[]) => {
    if (siteData.length === 0) {
      setSyncRuns({});
      return;
    }

    const entries = await Promise.all(
      siteData.map(async (site) => [
        site.id,
        await api.get<SiteSyncRun[]>(`/sites/${site.id}/sync-runs`),
      ] as const),
    );
    setSyncRuns(Object.fromEntries(entries));
  };

  const refreshSyncRuns = async (siteId: string) => {
    const runs = await api.get<SiteSyncRun[]>(`/sites/${siteId}/sync-runs`);
    setSyncRuns((current) => ({ ...current, [siteId]: runs }));
  };

  const handleCreatePlan = async (siteId: string) => {
    setPlanningId(siteId);
    try {
      const plan = await api.post<SiteSyncPlan>(`/sites/${siteId}/sync-plan`, {
        dryRun: true,
        queue: queueSiteRuns,
      });
      setPlans((current) => ({ ...current, [siteId]: plan }));
      await refreshSyncRuns(siteId);
    } catch (error) {
      console.error('Failed to create site sync plan:', error);
      alert(error instanceof Error ? error.message : '生成站点同步计划失败');
    } finally {
      setPlanningId(null);
    }
  };

  const handleSyncLive = async (site: Site) => {
    if (!confirm(`将申请同步 Nginx/OpenResty 站点配置：${site.name}，确认继续吗？`)) return;

    setSyncingId(site.id);
    try {
      const plan = await api.post<SiteSyncPlan>(`/sites/${site.id}/sync-plan`, {
        dryRun: false,
        queue: queueSiteRuns,
        confirmationText: site.name,
      });
      setPlans((current) => ({ ...current, [site.id]: plan }));
      if (plan.status === 'blocked' && plan.approval) {
        alert('已生成站点同步审批单，可在操作审批页面批准后执行');
      }
      await loadData();
    } catch (error) {
      console.error('Failed to sync site:', error);
      alert(error instanceof Error ? error.message : '申请站点同步失败');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDiagnostics = async (site: Site) => {
    setDiagnosingId(site.id);
    try {
      const plan = await api.post<SiteSyncPlan>(`/sites/${site.id}/diagnostics`, {
        dryRun: false,
        queue: queueSiteRuns,
        tailLines: 200,
      });
      setPlans((current) => ({ ...current, [site.id]: plan }));
      await refreshSyncRuns(site.id);
    } catch (error) {
      console.error('Failed to run site diagnostics:', error);
      alert(error instanceof Error ? error.message : '执行站点诊断失败');
    } finally {
      setDiagnosingId(null);
    }
  };

  const handleOpenRestyStatus = async (site: Site, dryRun = false) => {
    setProbingRuntimeId(site.id);
    try {
      const plan = await api.post<SiteSyncPlan>(`/sites/${site.id}/openresty-status`, {
        dryRun,
        queue: queueSiteRuns,
      });
      setPlans((current) => ({ ...current, [site.id]: plan }));
      await refreshSyncRuns(site.id);
    } catch (error) {
      console.error('Failed to run OpenResty runtime status probe:', error);
      alert(error instanceof Error ? error.message : '探测 OpenResty/Nginx 运行态失败');
    } finally {
      setProbingRuntimeId(null);
    }
  };

  const handleOpenRestyModules = async (site: Site, dryRun = false) => {
    setProbingModulesId(site.id);
    try {
      const plan = await api.post<SiteSyncPlan>(`/sites/${site.id}/openresty-modules`, {
        dryRun,
        queue: queueSiteRuns,
      });
      setPlans((current) => ({ ...current, [site.id]: plan }));
      await refreshSyncRuns(site.id);
    } catch (error) {
      console.error('Failed to run OpenResty module inventory:', error);
      alert(error instanceof Error ? error.message : '盘点 OpenResty/Nginx 模块失败');
    } finally {
      setProbingModulesId(null);
    }
  };

  const handleOpenRestyModuleBaseline = async (site: Site, dryRun = false) => {
    setCheckingModuleBaselineId(site.id);
    try {
      const plan = await api.post<SiteSyncPlan>(`/sites/${site.id}/openresty-module-baseline`, {
        dryRun,
        queue: queueSiteRuns,
      });
      setPlans((current) => ({ ...current, [site.id]: plan }));
      await refreshSyncRuns(site.id);
    } catch (error) {
      console.error('Failed to run OpenResty module baseline check:', error);
      alert(error instanceof Error ? error.message : '检查 OpenResty/Nginx 模块基线失败');
    } finally {
      setCheckingModuleBaselineId(null);
    }
  };

  const handleSmokeCheck = async (site: Site, dryRun = false) => {
    setSmokingId(site.id);
    try {
      const plan = await api.post<SiteSyncPlan>(`/sites/${site.id}/smoke-check`, {
        dryRun,
        queue: queueSiteRuns,
      });
      setPlans((current) => ({ ...current, [site.id]: plan }));
      await refreshSyncRuns(site.id);
    } catch (error) {
      console.error('Failed to run site smoke check:', error);
      alert(error instanceof Error ? error.message : '执行站点 Smoke 检查失败');
    } finally {
      setSmokingId(null);
    }
  };

  const handleTlsProbe = async (site: Site) => {
    setProbingTlsId(site.id);
    try {
      const plan = await api.post<SiteSyncPlan>(`/sites/${site.id}/tls-probe`, {
        dryRun: false,
        queue: queueSiteRuns,
      });
      setPlans((current) => ({ ...current, [site.id]: plan }));
      await loadData();
    } catch (error) {
      console.error('Failed to probe site TLS certificate:', error);
      alert(error instanceof Error ? error.message : '探测站点 TLS 证书失败');
    } finally {
      setProbingTlsId(null);
    }
  };

  const handleTlsProbePlan = async (site: Site) => {
    setProbingTlsId(site.id);
    try {
      const plan = await api.post<SiteSyncPlan>(`/sites/${site.id}/tls-probe`, {
        dryRun: true,
        queue: queueSiteRuns,
      });
      setPlans((current) => ({ ...current, [site.id]: plan }));
      await refreshSyncRuns(site.id);
    } catch (error) {
      console.error('Failed to create site TLS probe plan:', error);
      alert(error instanceof Error ? error.message : '生成站点 TLS 探测计划失败');
    } finally {
      setProbingTlsId(null);
    }
  };

  const handleTlsRenew = async (site: Site, dryRun: boolean) => {
    if (!dryRun && !confirm(`将申请续期 TLS 证书：${site.name}，确认继续吗？`)) return;

    setRenewingTlsId(site.id);
    try {
      const plan = await api.post<SiteSyncPlan>(`/sites/${site.id}/tls-renew`, {
        dryRun,
        queue: queueSiteRuns,
        confirmationText: dryRun ? undefined : site.name,
      });
      setPlans((current) => ({ ...current, [site.id]: plan }));
      if (plan.status === 'blocked' && plan.approval) {
        alert('已生成证书续期审批单，可在操作审批页面批准后执行');
      }
      await loadData();
    } catch (error) {
      console.error('Failed to renew site TLS certificate:', error);
      alert(error instanceof Error ? error.message : '申请站点 TLS 证书续期失败');
    } finally {
      setRenewingTlsId(null);
    }
  };

  const handleRollback = async (site: Site, run: SiteSyncRun) => {
    if (!confirm(`将申请把 ${site.name} 回滚到 ${formatDateTime(run.startedAt)} 的 Nginx 配置，确认继续吗？`)) return;

    setRollingBackId(run.id);
    try {
      const plan = await api.post<SiteSyncPlan>(`/sites/${site.id}/sync-runs/${run.id}/rollback`, {
        dryRun: false,
        queue: queueSiteRuns,
        confirmationText: site.name,
      });
      setPlans((current) => ({ ...current, [site.id]: plan }));
      if (plan.status === 'blocked' && plan.approval) {
        alert('已生成站点回滚审批单，可在操作审批页面批准后执行');
      }
      await loadData();
    } catch (error) {
      console.error('Failed to rollback site:', error);
      alert(error instanceof Error ? error.message : '申请回滚站点配置失败');
    } finally {
      setRollingBackId(null);
    }
  };

  const handleDelete = async (siteId: string) => {
    if (!confirm('确定要删除这个站点吗？')) return;

    try {
      await api.delete(`/sites/${siteId}`);
      setSites((current) => current.filter((site) => site.id !== siteId));
      setPlans((current) => {
        const next = { ...current };
        delete next[siteId];
        return next;
      });
      setSyncRuns((current) => {
        const next = { ...current };
        delete next[siteId];
        return next;
      });
    } catch (error) {
      console.error('Failed to delete site:', error);
      alert(error instanceof Error ? error.message : '删除站点失败');
    }
  };

  const handleSaveTakeoverBinding = async (site: Site) => {
    const form = takeoverForms[site.id] || createSiteTakeoverForm(site);
    setSavingTakeoverId(site.id);

    try {
      const updated = await api.put<Site>(`/sites/${site.id}`, {
        serverId: form.serverId,
        tls: buildSiteTakeoverTls(site, form),
        status: site.status,
      });
      setSites((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setTakeoverForms((current) => ({
        ...current,
        [updated.id]: createSiteTakeoverForm(updated),
      }));
      alert('已保存站点接管绑定');
    } catch (error) {
      console.error('Failed to save site takeover binding:', error);
      alert(error instanceof Error ? error.message : '保存站点接管绑定失败');
    } finally {
      setSavingTakeoverId(null);
    }
  };

  const handleActivatePreviewSite = async (site: Site) => {
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
      const result = await api.post<PreviewSiteTakeoverResult>(`/sites/${site.id}/preview-takeover`, {
        serverId: form.serverId,
        upstreamUrl: form.upstreamUrl.trim(),
        websocket: form.websocket,
        tls: buildSiteTakeoverTls(site, form),
        createDryRunPlan: true,
        queue: queueSiteRuns,
      });
      setSites((current) => current.map((item) => (item.id === result.site.id ? result.site : item)));
      setTakeoverForms((current) => ({
        ...current,
        [result.site.id]: createSiteTakeoverForm(result.site),
      }));
      if (result.syncPlan) {
        setPlans((current) => ({ ...current, [site.id]: result.syncPlan! }));
      }
      await refreshSyncRuns(site.id);
    } catch (error) {
      console.error('Failed to activate preview site takeover:', error);
      alert(error instanceof Error ? error.message : '接管预览站点失败');
    } finally {
      setActivatingPreviewId(null);
    }
  };

  const focusedSite = focusedSiteId ? sites.find((site) => site.id === focusedSiteId) || null : null;
  const focusedPlan = focusedSite ? plans[focusedSite.id] : null;
  const focusedRecentRuns = focusedSite ? syncRuns[focusedSite.id] || [] : [];
  const focusedRuntimeConfig = focusedSite ? readRecord(focusedSite.runtimeConfig) : {};
  const focusedTls = focusedSite ? readRecord(focusedSite.tls) : {};
  const focusedTlsAssets = readRecordArray(focusedTls.assets);
  const focusedTlsSummary = formatTlsCertificateSummary(focusedTls);
  const focusedTakeoverForm = focusedSite ? takeoverForms[focusedSite.id] || createSiteTakeoverForm(focusedSite) : null;
  const focusedIsPreviewPlaceholder = focusedSite ? isPreviewSitePlaceholder(focusedSite) : false;

  useEffect(() => {
    if (!focusedSite) return;

    setTakeoverForms((current) => (
      current[focusedSite.id]
        ? current
        : { ...current, [focusedSite.id]: createSiteTakeoverForm(focusedSite) }
    ));
  }, [focusedSite?.id]);

  const updateFocusedTakeoverForm = (patch: Partial<SiteTakeoverForm>) => {
    if (!focusedSite) return;

    setTakeoverForms((current) => ({
      ...current,
      [focusedSite.id]: {
        ...createSiteTakeoverForm(focusedSite),
        ...current[focusedSite.id],
        ...patch,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">站点管控</h1>
          <p className="mt-1 text-muted-foreground">以站点维度管理域名、运行时、TLS、访问策略和同步计划</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={queueSiteRuns}
              onChange={(event) => setQueueSiteRuns(event.target.checked)}
            />
            站点操作加入队列
          </label>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加站点
          </button>
        </div>
      </div>

      {(projectId || environmentId) && (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          当前按项目/环境筛选站点。清除浏览器地址中的 projectId 和 environmentId 可查看全部站点。
        </div>
      )}

      {!loading && siteId && !focusedSite && sites.length > 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          链接中的站点不在当前筛选结果内，请确认项目/环境筛选条件是否匹配。
        </div>
      )}

      {!loading && focusedSite && (
        <section className="rounded-lg border border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">接管站点：{focusedSite.name}</h2>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(focusedSite.status)}`}>
                  {getStatusLabel(focusedSite.status)}
                </span>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {runtimeTypeLabels[focusedSite.runtimeType] || focusedSite.runtimeType}
                </span>
              </div>
              <div className="font-mono text-sm">{focusedSite.primaryDomain}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>项目：{focusedSite.project?.name || '未关联'}</span>
                <span>环境：{focusedSite.environment?.name || '未绑定'}</span>
                <span>服务器：{focusedSite.server ? `${focusedSite.server.name} (${focusedSite.server.host})` : '未关联'}</span>
                <span>上游：{describeRuntime(focusedSite.runtimeType, focusedRuntimeConfig)}</span>
              </div>
              {focusedTlsSummary && (
                <div className="text-xs text-muted-foreground">
                  证书：{focusedTlsSummary}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                从复制结果进入后，可先生成 dry-run 计划，再决定是否绑定服务器、申请同步或处理 TLS。
              </div>
              {focusedIsPreviewPlaceholder && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
                  当前是 PR Preview draft Site 占位，补齐目标服务器和上游地址后才能生成可同步的 Nginx/OpenResty 计划。
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCreatePlan(focusedSite.id)}
                disabled={planningId === focusedSite.id}
                className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {planningId === focusedSite.id ? '生成中...' : 'Nginx/OpenResty 计划'}
              </button>
              <button
                type="button"
                onClick={() => handleTlsProbePlan(focusedSite)}
                disabled={probingTlsId === focusedSite.id}
                className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {probingTlsId === focusedSite.id ? '生成中...' : 'TLS 探测计划'}
              </button>
              <button
                type="button"
                onClick={() => handleOpenRestyStatus(focusedSite)}
                disabled={probingRuntimeId === focusedSite.id}
                className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {probingRuntimeId === focusedSite.id
                  ? (queueSiteRuns ? '状态入队中...' : '探测中...')
                  : (queueSiteRuns ? '运行态入队' : '运行态探测')}
              </button>
              <button
                type="button"
                onClick={() => handleOpenRestyModules(focusedSite)}
                disabled={probingModulesId === focusedSite.id}
                className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {probingModulesId === focusedSite.id
                  ? (queueSiteRuns ? '模块入队中...' : '盘点中...')
                  : (queueSiteRuns ? '模块入队' : '模块盘点')}
              </button>
              <button
                type="button"
                onClick={() => handleOpenRestyModuleBaseline(focusedSite)}
                disabled={checkingModuleBaselineId === focusedSite.id}
                className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingModuleBaselineId === focusedSite.id
                  ? (queueSiteRuns ? '基线入队中...' : '检查中...')
                  : (queueSiteRuns ? '基线入队' : '基线检查')}
              </button>
              <button
                type="button"
                onClick={() => handleSmokeCheck(focusedSite)}
                disabled={smokingId === focusedSite.id}
                className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {smokingId === focusedSite.id
                  ? (queueSiteRuns ? '检查入队中...' : '检查中...')
                  : (queueSiteRuns ? 'Smoke 入队' : 'Smoke 检查')}
              </button>
              <button
                type="button"
                onClick={() => setFocusedSiteId('')}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                收起
              </button>
            </div>
          </div>

          {focusedTakeoverForm && (
            <div className="mt-4 rounded-md border bg-background p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">接管绑定</div>
                <button
                  type="button"
                  onClick={() => handleSaveTakeoverBinding(focusedSite)}
                  disabled={savingTakeoverId === focusedSite.id}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingTakeoverId === focusedSite.id ? '保存中...' : '保存绑定'}
                </button>
                {focusedIsPreviewPlaceholder && (
                  <button
                    type="button"
                    onClick={() => handleActivatePreviewSite(focusedSite)}
                    disabled={activatingPreviewId === focusedSite.id}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {activatingPreviewId === focusedSite.id
                      ? (queueSiteRuns ? '接管入队中...' : '接管中...')
                      : (queueSiteRuns ? '接管预览并入队' : '接管预览并生成计划')}
                  </button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">目标服务器</label>
                  <select
                    value={focusedTakeoverForm.serverId}
                    onChange={(event) => updateFocusedTakeoverForm({ serverId: event.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">不关联服务器</option>
                    {servers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name} ({server.host})
                      </option>
                    ))}
                  </select>
                </div>

                {focusedIsPreviewPlaceholder && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">预览上游地址</label>
                      <input
                        value={focusedTakeoverForm.upstreamUrl}
                        onChange={(event) => updateFocusedTakeoverForm({ upstreamUrl: event.target.value })}
                        className="w-full rounded-md border px-3 py-2 font-mono text-sm"
                        placeholder="http://127.0.0.1:3042"
                      />
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={focusedTakeoverForm.websocket}
                          onChange={(event) => updateFocusedTakeoverForm({ websocket: event.target.checked })}
                        />
                        WebSocket
                      </label>
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">TLS 类型</label>
                  <select
                    value={focusedTakeoverForm.tlsType}
                    onChange={(event) => updateFocusedTakeoverForm({ tlsType: event.target.value })}
                    disabled={!focusedTakeoverForm.tlsEnabled}
                    className="w-full rounded-md border px-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
                  >
                    <option value="letsencrypt">Let&apos;s Encrypt</option>
                    <option value="custom">自定义证书</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={focusedTakeoverForm.tlsEnabled}
                      onChange={(event) => updateFocusedTakeoverForm({ tlsEnabled: event.target.checked })}
                    />
                    启用 TLS
                  </label>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">证书邮箱</label>
                  <input
                    value={focusedTakeoverForm.tlsEmail}
                    onChange={(event) => updateFocusedTakeoverForm({ tlsEmail: event.target.value })}
                    disabled={!focusedTakeoverForm.tlsEnabled || focusedTakeoverForm.tlsType !== 'letsencrypt'}
                    className="w-full rounded-md border px-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
                    placeholder="ops@example.com"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">证书名</label>
                  <input
                    value={focusedTakeoverForm.tlsCertName}
                    onChange={(event) => updateFocusedTakeoverForm({ tlsCertName: event.target.value })}
                    disabled={!focusedTakeoverForm.tlsEnabled}
                    className="w-full rounded-md border px-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
                    placeholder={focusedSite.primaryDomain}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">观测证书资产</label>
                  <select
                    value={focusedTakeoverForm.tlsAssetId}
                    onChange={(event) => updateFocusedTakeoverForm({ tlsAssetId: event.target.value })}
                    disabled={!focusedTakeoverForm.tlsEnabled || focusedTlsAssets.length === 0}
                    className="w-full rounded-md border px-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {focusedTlsAssets.length === 0 ? (
                      <option value="">暂无可绑定资产</option>
                    ) : (
                      <>
                        <option value="">不绑定观测资产</option>
                        {focusedTlsAssets.map((asset, index) => {
                          const assetId = readString(asset.id) || `asset-${index}`;

                          return (
                            <option key={assetId} value={assetId}>
                              {formatTlsAssetLabel(asset)}
                            </option>
                          );
                        })}
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}

          {(focusedPlan || focusedRecentRuns.length > 0) && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {focusedPlan && (
                <div className="rounded-md border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium">
                      {focusedPlan.executorKey} · {focusedPlan.adapterKey} · {focusedPlan.mode}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-medium ${getStatusClass(focusedPlan.status || (focusedPlan.executable ? 'active' : 'pending'))}`}>
                      {getStatusLabel(focusedPlan.status || (focusedPlan.executable ? 'active' : 'pending'))}
                    </span>
                  </div>
                  {focusedPlan.warnings.length > 0 && (
                    <div className="mt-2 space-y-1 text-xs text-yellow-800">
                      {focusedPlan.warnings.slice(0, 3).map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 space-y-2">
                    {focusedPlan.commandPlan.slice(0, 3).map((step) => (
                      <div key={step.key} className="rounded bg-muted/50 p-2">
                        <div className="text-xs font-medium">{step.label}</div>
                        <code className="mt-1 block break-all text-xs text-muted-foreground">
                          {step.command || '当前配置下无需命令'}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {focusedRecentRuns.length > 0 && (
                <div className="rounded-md border bg-background p-3">
                  <div className="mb-2 text-xs font-medium">最近执行记录</div>
                  <div className="space-y-2">
                    {focusedRecentRuns.slice(0, 3).map((run) => (
                      <div key={run.id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium">{getRunModeLabel(run.mode)}</span>
                        <span className={`rounded-full px-2 py-0.5 font-medium ${getStatusClass(run.status)}`}>
                          {getStatusLabel(run.status)}
                        </span>
                        {run.dryRun && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">dry-run</span>
                        )}
                        <span className="text-muted-foreground">{formatDateTime(run.startedAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">加载中...</div>
      ) : sites.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9h.01M9 12h.01M9 15h.01M13 9h.01M13 12h.01M13 15h.01" />
          </svg>
          <h3 className="mt-4 text-lg font-medium">还没有站点</h3>
          <p className="mt-2 text-muted-foreground">添加站点后可以生成 Nginx 同步计划</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sites.map((site) => {
            const plan = plans[site.id];
            const recentRuns = syncRuns[site.id] || [];
            const runtimeConfig = readRecord(site.runtimeConfig);
            const tls = readRecord(site.tls);
            const aliases = readStringArray(site.aliases);
            const tlsSummary = formatTlsCertificateSummary(tls);
            const tlsRenewalSummary = formatTlsRenewalSummary(tls);
            const hasTls = readBoolean(tls.enabled) || Boolean(tlsSummary);
            const canRenewTls = readBoolean(tls.enabled) && readString(tls.type) === 'letsencrypt';
            const isFocused = focusedSiteId === site.id;

            return (
              <div
                key={site.id}
                className={`rounded-lg border p-4 ${isFocused ? 'border-primary/50 bg-primary/5 shadow-sm' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{site.name}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(site.status)}`}>
                        {getStatusLabel(site.status)}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {runtimeTypeLabels[site.runtimeType] || site.runtimeType}
                      </span>
                      {hasTls && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          TLS
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-sm">{site.primaryDomain}</div>
                    {aliases.length > 0 && (
                      <div className="text-xs text-muted-foreground">别名：{aliases.join(', ')}</div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>项目：{site.project?.name || '未关联'}</span>
                      <span>环境：{site.environment?.name || '未绑定'}</span>
                      <span>服务器：{site.server ? `${site.server.name} (${site.server.host})` : '未关联'}</span>
                      <span>上游：{describeRuntime(site.runtimeType, runtimeConfig)}</span>
                    </div>
                    {tlsSummary && (
                      <div className="text-xs text-muted-foreground">
                        证书：{tlsSummary}
                      </div>
                    )}
                    {tlsRenewalSummary && (
                      <div className="text-xs text-muted-foreground">
                        续期：{tlsRenewalSummary}
                      </div>
                    )}
                    {site.proxyConfig && (
                      <div className="text-xs text-muted-foreground">
                        关联代理配置：{site.proxyConfig.name} · {site.proxyConfig.domain}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCreatePlan(site.id)}
                      disabled={planningId === site.id}
                      className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {planningId === site.id
                        ? (queueSiteRuns ? '入队中...' : '生成中...')
                        : (queueSiteRuns ? '计划入队' : '同步计划')}
                    </button>
	                    <button
	                      onClick={() => handleSyncLive(site)}
	                      disabled={syncingId === site.id}
	                      className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {syncingId === site.id
                        ? (queueSiteRuns ? '申请入队中...' : '申请中...')
	                        : (queueSiteRuns ? '申请同步入队' : '申请同步')}
	                    </button>
	                    <button
	                      onClick={() => handleDiagnostics(site)}
	                      disabled={diagnosingId === site.id}
	                      className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
	                    >
	                      {diagnosingId === site.id
	                        ? (queueSiteRuns ? '诊断入队中...' : '诊断中...')
	                        : (queueSiteRuns ? '诊断入队' : '诊断')}
	                    </button>
                    <button
                      onClick={() => handleOpenRestyStatus(site)}
                      disabled={probingRuntimeId === site.id}
                      className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {probingRuntimeId === site.id
                        ? (queueSiteRuns ? '状态入队中...' : '探测中...')
                        : (queueSiteRuns ? '状态入队' : 'OpenResty 状态')}
                    </button>
                    <button
                      onClick={() => handleOpenRestyModules(site)}
                      disabled={probingModulesId === site.id}
                      className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {probingModulesId === site.id
                        ? (queueSiteRuns ? '模块入队中...' : '盘点中...')
                        : (queueSiteRuns ? '模块入队' : 'OpenResty 模块')}
                    </button>
                    <button
                      onClick={() => handleOpenRestyModuleBaseline(site)}
                      disabled={checkingModuleBaselineId === site.id}
                      className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {checkingModuleBaselineId === site.id
                        ? (queueSiteRuns ? '基线入队中...' : '检查中...')
                        : (queueSiteRuns ? '基线入队' : '模块基线')}
                    </button>
                    <button
                      onClick={() => handleSmokeCheck(site)}
                      disabled={smokingId === site.id}
                      className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {smokingId === site.id
                        ? (queueSiteRuns ? '检查入队中...' : '检查中...')
                        : (queueSiteRuns ? 'Smoke 入队' : 'Smoke 检查')}
                    </button>
                    <button
                      onClick={() => handleTlsProbe(site)}
                      disabled={probingTlsId === site.id}
                      className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {probingTlsId === site.id
                        ? (queueSiteRuns ? '探测入队中...' : '探测中...')
                        : (queueSiteRuns ? '证书探测入队' : '证书探测')}
                    </button>
                    {canRenewTls && (
                      <>
                        <button
                          onClick={() => handleTlsRenew(site, true)}
                          disabled={renewingTlsId === site.id}
                          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                        >
                          {renewingTlsId === site.id
                            ? (queueSiteRuns ? '演练入队中...' : '演练中...')
                            : (queueSiteRuns ? '续期演练入队' : '续期演练')}
                        </button>
                        <button
                          onClick={() => handleTlsRenew(site, false)}
                          disabled={renewingTlsId === site.id}
                          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                        >
                          {renewingTlsId === site.id
                            ? (queueSiteRuns ? '申请入队中...' : '申请中...')
                            : (queueSiteRuns ? '申请续期入队' : '申请续期')}
                        </button>
                      </>
                    )}
	                    <button
	                      onClick={() => handleDelete(site.id)}
                      className="rounded-md px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                    >
                      删除
                    </button>
                  </div>
                </div>

                {recentRuns.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">最近同步记录</div>
                      <div className="text-xs text-muted-foreground">{recentRuns.length} 条</div>
                    </div>
                    <div className="space-y-2">
                      {recentRuns.slice(0, 4).map((run) => {
                        const canRollback = run.mode === 'sync' && run.status === 'completed' && !run.dryRun;

                        return (
                          <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-xs">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{getRunModeLabel(run.mode)}</span>
                                <span className={`rounded-full px-2 py-0.5 font-medium ${getStatusClass(run.status)}`}>
                                  {getStatusLabel(run.status)}
                                </span>
                                {run.dryRun && (
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">dry-run</span>
                                )}
                                {run.operationApproval && (
                                  <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700">
                                    审批{getStatusLabel(run.operationApproval.status)}
                                  </span>
                                )}
                                {run.serverExecutionJob && (
                                  <Link
                                    href="/execution-governance"
                                    className="text-primary hover:underline"
                                  >
                                    Job {run.serverExecutionJob.id.slice(0, 8)} · {getStatusLabel(run.serverExecutionJob.status)}
                                  </Link>
                                )}
                                <span className="text-muted-foreground">{formatDateTime(run.startedAt)}</span>
                              </div>
                              <div className="truncate font-mono text-muted-foreground">
                                {run.targetConfigPath || '未记录目标配置路径'}
                              </div>
                              {run.configDiff?.summary && (
                                <div className="text-muted-foreground">{run.configDiff.summary}</div>
                              )}
	                              {run.error && (
	                                <div className="text-red-700">{run.error}</div>
	                              )}
	                              {formatRunLogPreview(run.logs) && (
	                                <pre className="mt-2 max-h-28 overflow-auto rounded bg-background p-2 text-muted-foreground">
	                                  {formatRunLogPreview(run.logs)}
	                                </pre>
	                              )}
	                            </div>
                            {canRollback && (
                              <button
                                onClick={() => handleRollback(site, run)}
                                disabled={rollingBackId === run.id}
                                className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
                              >
                                {rollingBackId === run.id
                                  ? (queueSiteRuns ? '申请入队中...' : '申请中...')
                                  : (queueSiteRuns ? '申请回滚入队' : '申请回滚')}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {plan && (
                  <div className="mt-4 border-t pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {plan.executorKey} · {plan.adapterKey} · {plan.mode}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(plan.status || (plan.executable ? 'active' : 'pending'))}`}>
                        {getStatusLabel(plan.status || (plan.executable ? 'active' : 'pending'))}
                      </span>
                    </div>

	                    {plan.error && (
	                      <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
	                        {plan.error}
	                      </div>
	                    )}

	                    {formatRunLogPreview(plan.logs) && (
	                      <pre className="mt-3 max-h-36 overflow-auto rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
	                        {formatRunLogPreview(plan.logs)}
	                      </pre>
	                    )}

	                    {plan.approval && (
                      <div className="mt-3 rounded-md border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800">
                        已生成操作审批：{plan.approval.id} · {getStatusLabel(plan.approval.status)}
                      </div>
                    )}

                    {plan.configDiff && (
                      <div className="mt-3 rounded-md border bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-medium">配置差异</span>
                          <span className="text-muted-foreground">
                            +{plan.configDiff.added} / -{plan.configDiff.removed} / ={plan.configDiff.unchanged}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{plan.configDiff.summary}</div>
                        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-background p-3 text-xs">
                          {plan.configDiff.unifiedDiff}
                        </pre>
                      </div>
                    )}

                    {plan.warnings.length > 0 && (
                      <div className="mt-3 space-y-1 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
                        {plan.warnings.map((warning) => (
                          <div key={warning}>{warning}</div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="space-y-2">
                        {plan.commandPlan.map((step) => (
                          <div key={step.key} className="rounded-md bg-muted/50 p-3">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium">{step.label}</span>
                              <span className="text-muted-foreground">{step.required ? '必需' : '可选'}</span>
                            </div>
                            <code className="mt-1 block whitespace-pre-wrap break-all text-xs text-muted-foreground">
                              {step.command || '当前配置下无需命令'}
                            </code>
                          </div>
                        ))}
                      </div>
                      {plan.nginxConfig ? (
                        <pre className="max-h-96 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                          {plan.nginxConfig}
                        </pre>
                      ) : (
                        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                          本次操作不生成 Nginx 配置
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <AddSiteModal
          servers={servers}
          projects={projects}
          projectEnvironments={projectEnvironments}
          proxyConfigs={proxyConfigs}
          defaultProjectId={projectId}
          defaultEnvironmentId={environmentId}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

export default function SitesPage() {
  return (
    <SuspenseBoundary fallback={<div className="py-12 text-center text-muted-foreground">加载中...</div>}>
      <SitesContent />
    </SuspenseBoundary>
  );
}

function AddSiteModal({
  servers,
  projects,
  projectEnvironments,
  proxyConfigs,
  defaultProjectId,
  defaultEnvironmentId,
  onClose,
  onSuccess,
}: {
  servers: Server[];
  projects: Project[];
  projectEnvironments: ProjectEnvironment[];
  proxyConfigs: ProxyConfig[];
  defaultProjectId: string;
  defaultEnvironmentId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    primaryDomain: '',
    aliases: '',
    runtimeType: 'reverse_proxy' as SiteRuntimeType,
    upstreamUrl: '',
    rootPath: '',
    containerName: '',
    containerPort: '3000',
    websocket: false,
    tlsEnabled: false,
    tlsType: 'letsencrypt',
    tlsEmail: '',
    allowedCidrs: '',
    basicAuth: false,
    serverId: '',
    projectId: defaultProjectId,
    environmentId: defaultEnvironmentId,
    proxyConfigId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.post('/sites', {
        name: formData.name,
        primaryDomain: formData.primaryDomain,
        aliases: splitCsv(formData.aliases),
        runtimeType: formData.runtimeType,
        runtimeConfig: buildRuntimeConfig(formData),
        tls: {
          enabled: formData.tlsEnabled,
          type: formData.tlsEnabled ? formData.tlsType : 'none',
          email: formData.tlsEmail || undefined,
        },
        accessPolicy: {
          allowedCidrs: splitCsv(formData.allowedCidrs),
          basicAuth: formData.basicAuth,
        },
        serverId: formData.serverId || undefined,
        projectId: formData.projectId || undefined,
        environmentId: formData.environmentId || undefined,
        proxyConfigId: formData.proxyConfigId || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加站点失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">添加站点</h2>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">站点名称</label>
              <input
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                required
                className="w-full rounded-md border px-3 py-2"
                placeholder="生产站点"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">主域名</label>
              <input
                value={formData.primaryDomain}
                onChange={(event) => setFormData({ ...formData, primaryDomain: event.target.value })}
                required
                className="w-full rounded-md border px-3 py-2"
                placeholder="app.example.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">域名别名</label>
            <input
              value={formData.aliases}
              onChange={(event) => setFormData({ ...formData, aliases: event.target.value })}
              className="w-full rounded-md border px-3 py-2"
              placeholder="www.example.com, api.example.com"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">运行时类型</label>
              <select
                value={formData.runtimeType}
                onChange={(event) => setFormData({ ...formData, runtimeType: event.target.value as SiteRuntimeType })}
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="reverse_proxy">反向代理</option>
                <option value="static">静态站点</option>
                <option value="docker">Docker 服务</option>
                <option value="runtime">运行时服务</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">目标服务器</label>
              <select
                value={formData.serverId}
                onChange={(event) => setFormData({ ...formData, serverId: event.target.value })}
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="">不关联服务器</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name} ({server.host})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">关联项目</label>
              <select
                value={formData.projectId}
                onChange={(event) => setFormData({ ...formData, projectId: event.target.value, environmentId: '' })}
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="">不关联项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">项目环境</label>
            <select
              value={formData.environmentId}
              onChange={(event) => setFormData({ ...formData, environmentId: event.target.value })}
              className="w-full rounded-md border px-3 py-2"
              disabled={!formData.projectId}
            >
              <option value="">不绑定环境</option>
              {projectEnvironments
                .filter((environment) => environment.projectId === formData.projectId && environment.status !== 'archived')
                .map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.name} ({environment.key})
                  </option>
                ))}
            </select>
          </div>

          {formData.runtimeType === 'static' ? (
            <div>
              <label className="mb-1 block text-sm font-medium">静态目录</label>
              <input
                value={formData.rootPath}
                onChange={(event) => setFormData({ ...formData, rootPath: event.target.value })}
                className="w-full rounded-md border px-3 py-2 font-mono text-sm"
                placeholder="/var/www/app.example.com"
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">上游地址</label>
                <input
                  value={formData.upstreamUrl}
                  onChange={(event) => setFormData({ ...formData, upstreamUrl: event.target.value })}
                  className="w-full rounded-md border px-3 py-2 font-mono text-sm"
                  placeholder="http://127.0.0.1:3000"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">容器名</label>
                  <input
                    value={formData.containerName}
                    onChange={(event) => setFormData({ ...formData, containerName: event.target.value })}
                    className="w-full rounded-md border px-3 py-2"
                    placeholder="app"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">容器端口</label>
                  <input
                    value={formData.containerPort}
                    onChange={(event) => setFormData({ ...formData, containerPort: event.target.value })}
                    className="w-full rounded-md border px-3 py-2"
                    placeholder="3000"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">关联代理配置</label>
              <select
                value={formData.proxyConfigId}
                onChange={(event) => setFormData({ ...formData, proxyConfigId: event.target.value })}
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="">不关联代理配置</option>
                {proxyConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name} ({config.domain})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">允许 CIDR</label>
              <input
                value={formData.allowedCidrs}
                onChange={(event) => setFormData({ ...formData, allowedCidrs: event.target.value })}
                className="w-full rounded-md border px-3 py-2 font-mono text-sm"
                placeholder="10.0.0.0/8, 192.168.0.0/16"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.websocket}
                onChange={(event) => setFormData({ ...formData, websocket: event.target.checked })}
                className="rounded"
              />
              WebSocket
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.tlsEnabled}
                onChange={(event) => setFormData({ ...formData, tlsEnabled: event.target.checked })}
                className="rounded"
              />
              启用 TLS
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.basicAuth}
                onChange={(event) => setFormData({ ...formData, basicAuth: event.target.checked })}
                className="rounded"
              />
              Basic Auth
            </label>
          </div>

          {formData.tlsEnabled && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">证书类型</label>
                <select
                  value={formData.tlsType}
                  onChange={(event) => setFormData({ ...formData, tlsType: event.target.value })}
                  className="w-full rounded-md border px-3 py-2"
                >
                  <option value="letsencrypt">Let&apos;s Encrypt</option>
                  <option value="custom">自定义证书</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">证书邮箱</label>
                <input
                  value={formData.tlsEmail}
                  onChange={(event) => setFormData({ ...formData, tlsEmail: event.target.value })}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="ops@example.com"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? '添加中...' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function buildRuntimeConfig(formData: {
  runtimeType: SiteRuntimeType;
  upstreamUrl: string;
  rootPath: string;
  containerName: string;
  containerPort: string;
  websocket: boolean;
}) {
  if (formData.runtimeType === 'static') {
    return {
      rootPath: formData.rootPath || undefined,
    };
  }

  return {
    upstreamUrl: formData.upstreamUrl || undefined,
    containerName: formData.containerName || undefined,
    containerPort: formData.containerPort || undefined,
    websocket: formData.websocket,
  };
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : false;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => (
    typeof item === 'object' && item !== null && !Array.isArray(item)
  ));
}

function createSiteTakeoverForm(site: Site): SiteTakeoverForm {
  const tls = readRecord(site.tls);
  const runtimeConfig = readRecord(site.runtimeConfig);

  return {
    serverId: site.server?.id || '',
    upstreamUrl: readString(runtimeConfig.upstreamUrl) || '',
    websocket: readBoolean(runtimeConfig.websocket),
    tlsEnabled: readBoolean(tls.enabled),
    tlsType: readString(tls.type) || 'letsencrypt',
    tlsEmail: readString(tls.email) || '',
    tlsCertName: readString(tls.certName) || site.primaryDomain,
    tlsAssetId: readString(tls.currentCertificateAssetId) || '',
  };
}

function buildSiteTakeoverTls(site: Site, form: SiteTakeoverForm) {
  const currentTls = readRecord(site.tls);
  const nextTls: Record<string, unknown> = { ...currentTls };
  const assets = readRecordArray(currentTls.assets);
  const selectedAsset = assets.find((asset) => readString(asset.id) === form.tlsAssetId);

  nextTls.enabled = form.tlsEnabled;
  nextTls.type = form.tlsEnabled ? form.tlsType || 'letsencrypt' : 'none';

  if (form.tlsEnabled && form.tlsType === 'letsencrypt' && form.tlsEmail.trim()) {
    nextTls.email = form.tlsEmail.trim();
  } else {
    delete nextTls.email;
  }

  if (form.tlsEnabled && form.tlsCertName.trim()) {
    nextTls.certName = form.tlsCertName.trim();
  } else {
    delete nextTls.certName;
  }

  if (form.tlsEnabled && form.tlsAssetId) {
    nextTls.currentCertificateAssetId = form.tlsAssetId;
    if (selectedAsset) {
      nextTls.certificate = {
        ...readRecord(nextTls.certificate),
        ...selectedAsset,
      };
    }
  } else {
    delete nextTls.currentCertificateAssetId;
    if (!form.tlsEnabled) {
      delete nextTls.certificate;
    }
  }

  return nextTls;
}

function isPreviewSitePlaceholder(site: Site) {
  const runtimeConfig = readRecord(site.runtimeConfig);
  const preview = readRecord(runtimeConfig.preview);

  return readString(preview.kind) === 'draft_site_placeholder'
    && readString(preview.status) !== 'archived'
    && readBoolean(runtimeConfig.syncBlocked);
}

function formatTlsAssetLabel(asset: Record<string, unknown>) {
  const issuer = readString(asset.issuer);
  const expiresAt = readString(asset.expiresAt) || readString(asset.notAfter);
  const fingerprint = readString(asset.fingerprintSha256);
  const id = readString(asset.id);
  const parts = [
    issuer,
    expiresAt ? `${formatDateTime(expiresAt)} 到期` : '',
    fingerprint ? formatShortFingerprint(fingerprint) : '',
  ].filter(Boolean);

  return parts.join(' · ') || id || '未命名证书资产';
}

function formatTlsCertificateSummary(tls: Record<string, unknown>) {
  const certificate = readRecord(tls.certificate);
  const assets = readRecordArray(tls.assets);
  const currentCertificateAssetId = readString(tls.currentCertificateAssetId);
  const currentAsset = assets.find((asset) => readString(asset.id) === currentCertificateAssetId) || assets[0] || {};
  const expiresAt =
    readString(tls.expiresAt) ||
    readString(tls.notAfter) ||
    readString(tls.certificateExpiresAt) ||
    readString(certificate.expiresAt) ||
    readString(certificate.notAfter);
  const lastProbedAt = readString(tls.lastProbedAt) || readString(tls.probedAt) || readString(certificate.probedAt);
  const issuer = readString(tls.issuer) || readString(certificate.issuer);
  const daysRemaining = readNumber(tls.daysRemaining) ?? readNumber(certificate.daysRemaining);
  const fingerprint =
    readString(tls.fingerprintSha256) ||
    readString(certificate.fingerprintSha256) ||
    readString(currentAsset.fingerprintSha256);
  const parts: string[] = [];

  if (expiresAt) {
    parts.push(`${formatDateTime(expiresAt)} 到期`);
  }
  if (daysRemaining !== undefined) {
    parts.push(daysRemaining >= 0 ? `剩余 ${daysRemaining} 天` : `已过期 ${Math.abs(daysRemaining)} 天`);
  }
  if (issuer) {
    parts.push(`签发方 ${issuer}`);
  }
  if (lastProbedAt) {
    parts.push(`最近探测 ${formatDateTime(lastProbedAt)}`);
  }
  if (assets.length > 0) {
    parts.push(`资产 ${assets.length} 个`);
  }
  if (fingerprint) {
    parts.push(`指纹 ${formatShortFingerprint(fingerprint)}`);
  }

  return parts.join(' · ');
}

function formatShortFingerprint(value: string) {
  const compact = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (compact.length <= 12) return value;
  return `${compact.slice(0, 6)}...${compact.slice(-6)}`;
}

function formatTlsRenewalSummary(tls: Record<string, unknown>) {
  const renewal = readRecord(tls.renewal);
  const status = readString(tls.lastRenewalStatus) || readString(renewal.status);
  if (!status) return '';

  const followUpProbe = readRecord(renewal.followUpProbe);
  const checkedAt = readString(tls.lastRenewalCheckedAt) || readString(renewal.checkedAt);
  const dryRun = readBoolean(renewal.dryRun);
  const summary = readString(tls.lastRenewalSummary) || readString(renewal.summary);
  const followUpStatus = readString(tls.lastRenewalFollowUpProbeStatus) || readString(followUpProbe.status);
  const parts = [
    getTlsRenewalStatusLabel(status),
    dryRun ? '演练' : '正式续期',
  ];

  if (checkedAt) {
    parts.push(formatDateTime(checkedAt));
  }
  if (summary) {
    parts.push(summary);
  }
  if (followUpStatus) {
    parts.push(`续期后探测${getTlsFollowUpProbeStatusLabel(followUpStatus)}`);
  }

  return parts.join(' · ');
}

function getTlsRenewalStatusLabel(status: string) {
  if (status === 'succeeded') return '成功';
  if (status === 'not_due') return '未到续期窗口';
  if (status === 'failed') return '失败';
  if (status === 'unknown') return '结果未知';
  return status;
}

function getTlsFollowUpProbeStatusLabel(status: string) {
  if (status === 'queued') return '已排队';
  if (status === 'failed') return '失败';
  return status;
}

function describeRuntime(runtimeType: SiteRuntimeType, runtimeConfig: Record<string, unknown>) {
  if (runtimeType === 'static') {
    return readString(runtimeConfig.rootPath) || '未配置静态目录';
  }

  return (
    readString(runtimeConfig.upstreamUrl) ||
    [
      readString(runtimeConfig.containerName),
      readString(runtimeConfig.containerPort),
    ].filter(Boolean).join(':') ||
    '未配置上游'
  );
}

function getStatusLabel(status: string) {
  if (status === 'active') return '已生效';
  if (status === 'queued') return '排队中';
  if (status === 'pending') return '待同步';
  if (status === 'error') return '错误';
  if (status === 'draft') return '草稿';
  if (status === 'completed') return '完成';
  if (status === 'blocked') return '已阻止';
  if (status === 'failed') return '失败';
  if (status === 'approved') return '已批准';
  if (status === 'rejected') return '已拒绝';
  return status;
}

function getRunModeLabel(mode: string) {
  if (mode === 'tls_renew') return 'TLS 续期';
  if (mode === 'tls_probe') return 'TLS 探测';
  if (mode === 'smoke_check') return 'Smoke 检查';
  if (mode === 'openresty_module_baseline') return '模块基线';
  if (mode === 'openresty_modules') return 'OpenResty 模块';
  if (mode === 'openresty_status') return 'OpenResty 状态';
  if (mode === 'diagnostics') return '诊断';
  if (mode === 'rollback') return '回滚';
  if (mode === 'sync') return '同步';
  return mode;
}

function formatRunLogPreview(value: unknown) {
  const messages = readLogMessages(value);
  if (messages.length === 0) {
    return '';
  }
  return messages.slice(0, 6).join('\n');
}

function readLogMessages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const record = item as Record<string, unknown>;
      const stream = typeof record.stream === 'string' ? `[${record.stream}] ` : '';
      const level = typeof record.level === 'string' ? `${record.level}: ` : '';
      const message = typeof record.message === 'string' ? record.message : '';
      return `${stream}${level}${message}`.trim();
    })
    .filter(Boolean);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusClass(status: string) {
  if (status === 'queued') return 'bg-indigo-100 text-indigo-700';
  if (status === 'active' || status === 'completed' || status === 'approved') return 'bg-green-100 text-green-700';
  if (status === 'error' || status === 'failed' || status === 'rejected') return 'bg-red-100 text-red-700';
  if (status === 'pending' || status === 'blocked') return 'bg-yellow-100 text-yellow-700';
  return 'bg-muted text-muted-foreground';
}
