'use client';

import { createElement, Suspense as ReactSuspense, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function SuspenseBoundary({ children, fallback }: { children: ReactNode; fallback: ReactNode }): any {
  return createElement(ReactSuspense as any, { fallback }, children);
}

interface Project {
  id: string;
  name: string;
}

interface ProjectEnvironment {
  id: string;
  key: string;
  name: string;
  status: string;
  project?: Project | null;
}

interface Server {
  id: string;
  name: string;
  host: string;
  status: string;
}

interface Site {
  id: string;
  name: string;
  primaryDomain: string;
  projectId?: string | null;
  environmentId?: string | null;
}

interface ManagedResource {
  id: string;
  name: string;
  provider: string;
  kind: string;
  status: string;
  project?: Project | null;
  environment?: ProjectEnvironment | null;
}

interface ServerExecutionJobRef {
  id: string;
  status: string;
  queueMode: string;
  attempt: number;
  maxAttempts: number;
  queuedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

interface OperationRun {
  id: string;
  action: 'status' | 'logs' | 'restart' | 'rollback';
  dryRun: boolean;
  risk: 'low' | 'medium' | 'high';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked';
  serverExecutionJobId?: string | null;
  serverExecutionJob?: ServerExecutionJobRef | null;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

interface ApplicationServiceItem {
  id: string;
  name: string;
  kind: string;
  runtime?: string | null;
  image?: string | null;
  status: string;
  deployConfig?: Record<string, unknown> | null;
  environment: ProjectEnvironment;
  server?: Server | null;
  site?: { id: string; name: string; primaryDomain: string; status: string } | null;
  managedResource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    status: string;
  } | null;
  operationRuns?: OperationRun[];
  _count?: { deploymentRuns: number; operationRuns: number };
}

interface ApplicationItem {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  repositoryUrl?: string | null;
  repoPath?: string | null;
  defaultBranch?: string | null;
  status: string;
  project?: Project;
  services: ApplicationServiceItem[];
  _count?: { services: number; deploymentRuns: number; operationRuns: number };
}

const kindLabels: Record<string, string> = {
  'docker-compose': 'Docker Compose',
  container: '容器',
  static: '静态站点',
  external: '外部服务',
};

const operationLabels: Record<OperationRun['action'], string> = {
  status: '状态',
  logs: '日志',
  restart: '重启',
  rollback: '回滚',
};

export default function ApplicationsPage() {
  return (
    <SuspenseBoundary fallback={<div className="text-center py-12 text-muted-foreground">加载中...</div>}>
      <ApplicationsContent />
    </SuspenseBoundary>
  );
}

function ApplicationsContent() {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get('projectId') || '';
  const queryEnvironmentId = searchParams.get('environmentId') || '';
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deployingServiceId, setDeployingServiceId] = useState('');
  const [queueDeploymentRuns, setQueueDeploymentRuns] = useState(false);
  const [queueServiceOperations, setQueueServiceOperations] = useState(false);
  const [runningOperation, setRunningOperation] = useState('');
  const [error, setError] = useState('');
  const [appForm, setAppForm] = useState({
    projectId: '',
    name: '',
    repositoryUrl: '',
    defaultBranch: 'main',
    repoPath: '',
  });
  const [serviceForm, setServiceForm] = useState({
    applicationId: '',
    environmentId: '',
    name: '',
    kind: 'docker-compose',
    runtime: '',
    serverId: '',
    siteId: '',
    managedResourceId: '',
    workingDirectory: '',
    buildCommand: '',
    deployCommand: '',
    healthCheckUrl: '',
  });

  const loadData = async () => {
    setError('');
    try {
      const [appData, projectData, environmentData, serverData, siteData, resourceData] = await Promise.all([
        api.get<ApplicationItem[]>('/applications'),
        api.get<Project[]>('/projects'),
        api.get<ProjectEnvironment[]>('/project-environments', { params: { status: 'active' } }),
        api.get<Server[]>('/servers'),
        api.get<Site[]>('/sites'),
        api.get<ManagedResource[]>('/resource-control/resources'),
      ]);

      setApplications(appData);
      setProjects(projectData);
      setEnvironments(environmentData);
      setServers(serverData);
      setSites(siteData);
      setResources(resourceData);

      const projectApplications = queryProjectId
        ? appData.filter((application) => application.projectId === queryProjectId)
        : appData;
      const preferredApplication = projectApplications[0] || appData[0];
      const preferredEnvironment = queryEnvironmentId
        || preferredApplication?.services[0]?.environment.id
        || environmentData.find((environment) => environment.project?.id === queryProjectId)?.id
        || '';

      setAppForm((current) => ({
        ...current,
        projectId: queryProjectId || current.projectId || projectData[0]?.id || '',
      }));
      setServiceForm((current) => ({
        ...current,
        applicationId: queryProjectId
          ? (
            appData.some((application) => application.id === current.applicationId && application.projectId === queryProjectId)
              ? current.applicationId
              : preferredApplication?.id || ''
          )
          : current.applicationId || preferredApplication?.id || '',
        environmentId: queryEnvironmentId || current.environmentId || preferredEnvironment,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载应用服务数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryEnvironmentId, queryProjectId]);

  const selectedApplication = applications.find((application) => application.id === serviceForm.applicationId);
  const serviceProjectId = selectedApplication?.projectId || appForm.projectId;
  const serviceEnvironments = environments.filter((environment) => environment.project?.id === serviceProjectId);
  const serviceSites = sites.filter((site) => (
    (!site.projectId || site.projectId === serviceProjectId) &&
    (!site.environmentId || !serviceForm.environmentId || site.environmentId === serviceForm.environmentId)
  ));
  const serviceResources = resources.filter((resource) => (
    (!resource.project?.id || resource.project.id === serviceProjectId) &&
    (!resource.environment?.id || !serviceForm.environmentId || resource.environment.id === serviceForm.environmentId)
  ));
  const contextProject = queryProjectId ? projects.find((project) => project.id === queryProjectId) : null;
  const contextEnvironment = queryEnvironmentId ? environments.find((environment) => environment.id === queryEnvironmentId) : null;
  const applicationOptions = useMemo(() => (
    queryProjectId
      ? applications.filter((application) => application.projectId === queryProjectId)
      : applications
  ), [applications, queryProjectId]);
  const visibleApplications = useMemo(() => (
    applications
      .filter((application) => !queryProjectId || application.projectId === queryProjectId)
      .map((application) => ({
        ...application,
        services: queryEnvironmentId
          ? application.services.filter((service) => service.environment?.id === queryEnvironmentId)
          : application.services,
      }))
  ), [applications, queryEnvironmentId, queryProjectId]);

  const stats = useMemo(() => {
    const services = visibleApplications.flatMap((application) => application.services || []);
    return {
      applications: visibleApplications.length,
      services: services.length,
      environments: new Set(services.map((service) => service.environment?.id).filter(Boolean)).size,
      deployments: services.reduce((sum, service) => sum + (service._count?.deploymentRuns || 0), 0),
      operations: services.reduce((sum, service) => sum + (service._count?.operationRuns || 0), 0),
    };
  }, [visibleApplications]);

  const createApplication = async () => {
    if (!appForm.projectId || !appForm.name.trim()) {
      alert('请选择项目并填写应用名称');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const application = await api.post<ApplicationItem>('/applications', {
        projectId: appForm.projectId,
        name: appForm.name.trim(),
        repositoryUrl: appForm.repositoryUrl || undefined,
        defaultBranch: appForm.defaultBranch || undefined,
        repoPath: appForm.repoPath || undefined,
      });
      setAppForm((current) => ({ ...current, name: '', repoPath: '' }));
      setServiceForm((current) => ({ ...current, applicationId: application.id, environmentId: current.environmentId || queryEnvironmentId }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建应用失败');
    } finally {
      setSaving(false);
    }
  };

  const createService = async () => {
    if (!serviceForm.applicationId || !serviceForm.environmentId || !serviceForm.name.trim()) {
      alert('请选择应用、环境并填写服务名称');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const deployConfig = compactObject({
        targetType: serviceForm.kind === 'external' ? 'external-ci' : 'server',
        workingDirectory: serviceForm.workingDirectory,
        buildCommand: serviceForm.buildCommand,
        deployCommand: serviceForm.deployCommand,
        healthCheckUrl: serviceForm.healthCheckUrl,
      });

      await api.post(`/applications/${serviceForm.applicationId}/services`, {
        environmentId: serviceForm.environmentId,
        name: serviceForm.name.trim(),
        kind: serviceForm.kind,
        runtime: serviceForm.runtime || undefined,
        serverId: serviceForm.serverId || undefined,
        siteId: serviceForm.siteId || undefined,
        managedResourceId: serviceForm.managedResourceId || undefined,
        deployConfig: Object.keys(deployConfig).length > 0 ? deployConfig : undefined,
      });
      setServiceForm((current) => ({
        ...current,
        name: '',
        runtime: '',
        siteId: '',
        managedResourceId: '',
        workingDirectory: '',
        buildCommand: '',
        deployCommand: '',
        healthCheckUrl: '',
      }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建应用服务失败');
    } finally {
      setSaving(false);
    }
  };

  const createDeploymentPlan = async (application: ApplicationItem, service: ApplicationServiceItem) => {
    setDeployingServiceId(service.id);
    setError('');
    try {
      await api.post(`/deployments/projects/${application.projectId}/runs`, {
        applicationId: application.id,
        applicationServiceId: service.id,
        environmentId: service.environment.id,
        serverId: service.server?.id,
        dryRun: true,
        queue: queueDeploymentRuns,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成服务部署计划失败');
    } finally {
      setDeployingServiceId('');
    }
  };

  const runServiceOperation = async (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    action: OperationRun['action'],
  ) => {
    setRunningOperation(`${service.id}:${action}`);
    setError('');
    try {
      await api.post(`/applications/${application.id}/services/${service.id}/operations`, {
        action,
        dryRun: true,
        queue: queueServiceOperations,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成服务操作计划失败');
    } finally {
      setRunningOperation('');
    }
  };

  const requestServiceOperationApproval = async (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    action: OperationRun['action'],
  ) => {
    setRunningOperation(`${service.id}:${action}:live`);
    setError('');
    try {
      await api.post(`/applications/${application.id}/services/${service.id}/operations`, {
        action,
        dryRun: false,
        queue: queueServiceOperations,
        confirmationText: service.name,
        approvalReason: `申请对服务 ${service.name} 执行 ${operationLabels[action] || action}`,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '申请服务操作审批失败');
    } finally {
      setRunningOperation('');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">应用服务</h1>
          <p className="mt-1 text-muted-foreground">
            以服务为单位组织环境、服务器、站点、资源和部署配置
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={queueDeploymentRuns}
              onChange={(event) => setQueueDeploymentRuns(event.target.checked)}
            />
            部署计划加入队列
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={queueServiceOperations}
              onChange={(event) => setQueueServiceOperations(event.target.checked)}
            />
            服务操作加入队列
          </label>
          <button
            onClick={loadData}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {(queryProjectId || queryEnvironmentId) && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          当前上下文：
          <span className="ml-1 font-medium text-foreground">
            {contextProject?.name || (queryProjectId ? '未知项目' : '全部项目')}
          </span>
          <span className="mx-1">/</span>
          <span className="font-medium text-foreground">
            {contextEnvironment?.name || (queryEnvironmentId ? '未知环境' : '全部环境')}
          </span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="应用" value={stats.applications} />
        <Metric label="服务" value={stats.services} />
        <Metric label="涉及环境" value={stats.environments} />
        <Metric label="部署/操作" value={stats.deployments + stats.operations} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <section className="rounded-lg border p-4">
            <h2 className="font-semibold">创建应用</h2>
            <div className="mt-4 space-y-3">
              <select
                value={appForm.projectId}
                onChange={(event) => setAppForm({ ...appForm, projectId: event.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">选择项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <input
                value={appForm.name}
                onChange={(event) => setAppForm({ ...appForm, name: event.target.value })}
                placeholder="应用名称，例如 devpilot"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <input
                value={appForm.repositoryUrl}
                onChange={(event) => setAppForm({ ...appForm, repositoryUrl: event.target.value })}
                placeholder="Git 仓库 URL"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={appForm.defaultBranch}
                  onChange={(event) => setAppForm({ ...appForm, defaultBranch: event.target.value })}
                  placeholder="默认分支"
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                />
                <input
                  value={appForm.repoPath}
                  onChange={(event) => setAppForm({ ...appForm, repoPath: event.target.value })}
                  placeholder="仓库内路径"
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={createApplication}
                disabled={saving}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                创建应用
              </button>
            </div>
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="font-semibold">添加服务</h2>
            <div className="mt-4 space-y-3">
              <select
                value={serviceForm.applicationId}
                onChange={(event) => setServiceForm({
                  ...serviceForm,
                  applicationId: event.target.value,
                  environmentId: '',
                  siteId: '',
                  managedResourceId: '',
                })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">选择应用</option>
                {applicationOptions.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.project?.name ? `${application.project.name} / ` : ''}{application.name}
                  </option>
                ))}
              </select>
              <select
                value={serviceForm.environmentId}
                onChange={(event) => setServiceForm({ ...serviceForm, environmentId: event.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">选择环境</option>
                {serviceEnvironments.map((environment) => (
                  <option key={environment.id} value={environment.id}>{environment.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={serviceForm.name}
                  onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })}
                  placeholder="服务名称"
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                />
                <select
                  value={serviceForm.kind}
                  onChange={(event) => setServiceForm({ ...serviceForm, kind: event.target.value })}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="docker-compose">Docker Compose</option>
                  <option value="container">容器</option>
                  <option value="static">静态站点</option>
                  <option value="external">外部服务</option>
                </select>
              </div>
              <input
                value={serviceForm.runtime}
                onChange={(event) => setServiceForm({ ...serviceForm, runtime: event.target.value })}
                placeholder="运行时，例如 node/mysql/redis"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <select
                value={serviceForm.serverId}
                onChange={(event) => setServiceForm({ ...serviceForm, serverId: event.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">不绑定服务器</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>{server.name} ({server.host})</option>
                ))}
              </select>
              <select
                value={serviceForm.siteId}
                onChange={(event) => setServiceForm({ ...serviceForm, siteId: event.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">不绑定站点</option>
                {serviceSites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name} ({site.primaryDomain})</option>
                ))}
              </select>
              <select
                value={serviceForm.managedResourceId}
                onChange={(event) => setServiceForm({ ...serviceForm, managedResourceId: event.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">不绑定资源</option>
                {serviceResources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name} ({resource.provider}/{resource.kind})
                  </option>
                ))}
              </select>
              <input
                value={serviceForm.workingDirectory}
                onChange={(event) => setServiceForm({ ...serviceForm, workingDirectory: event.target.value })}
                placeholder="工作目录，例如 /srv/app"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <input
                value={serviceForm.buildCommand}
                onChange={(event) => setServiceForm({ ...serviceForm, buildCommand: event.target.value })}
                placeholder="构建命令"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <input
                value={serviceForm.deployCommand}
                onChange={(event) => setServiceForm({ ...serviceForm, deployCommand: event.target.value })}
                placeholder="部署命令"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <input
                value={serviceForm.healthCheckUrl}
                onChange={(event) => setServiceForm({ ...serviceForm, healthCheckUrl: event.target.value })}
                placeholder="健康检查 URL"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={createService}
                disabled={saving}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                添加服务
              </button>
            </div>
          </section>
        </div>

        <section className="rounded-lg border p-4">
          <h2 className="font-semibold">服务工作区</h2>
          {visibleApplications.length === 0 ? (
            <div className="mt-4 rounded-md border py-12 text-center text-sm text-muted-foreground">
              暂无当前上下文应用，先创建一个应用并添加环境服务
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {visibleApplications.map((application) => (
                <div key={application.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{application.name}</h3>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {application.project?.name || application.projectId}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {application.repositoryUrl || '未绑定仓库'}
                        {application.defaultBranch ? ` · ${application.defaultBranch}` : ''}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{application._count?.services || 0} 个服务</div>
                      <div>{(application._count?.deploymentRuns || 0) + (application._count?.operationRuns || 0)} 次运行</div>
                    </div>
                  </div>

                  {application.services.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      {queryEnvironmentId ? '暂无当前环境服务' : '暂无服务'}
                    </p>
                  ) : (
                    <div className="mt-4 divide-y">
                      {application.services.map((service) => (
                        <div key={service.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{service.name}</span>
                                <StatusBadge status={service.status} />
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                  {kindLabels[service.kind] || service.kind}
                                </span>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                  {service.environment?.name || '未绑定环境'}
                                </span>
                              </div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                {service.server ? `${service.server.name} (${service.server.host})` : '未绑定服务器'}
                                {service.site ? ` · ${service.site.primaryDomain}` : ''}
                                {service.managedResource ? ` · ${service.managedResource.name}` : ''}
                              </div>
                              {service.runtime && (
                                <div className="mt-1 text-xs text-muted-foreground">runtime: {service.runtime}</div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 lg:justify-end">
                              {(['status', 'logs', 'restart', 'rollback'] as const).map((action) => {
                                const isRunning = runningOperation === `${service.id}:${action}`;
                                const isRequestingLive = runningOperation === `${service.id}:${action}:live`;
                                const canRequestLive = action === 'restart' || action === 'rollback';
                                const planLabel = queueServiceOperations ? `${operationLabels[action]}入队` : operationLabels[action];
                                const pendingPlanLabel = queueServiceOperations ? '入队中...' : '生成中...';
                                const liveLabel = queueServiceOperations ? '申请入队' : '申请 Live';
                                const pendingLiveLabel = queueServiceOperations ? '入队中...' : '申请中...';
                                return (
                                  <div key={action} className="flex gap-1">
                                    <button
                                      onClick={() => runServiceOperation(application, service, action)}
                                      disabled={isRunning}
                                      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                                    >
                                      {isRunning ? pendingPlanLabel : planLabel}
                                    </button>
                                    {canRequestLive && (
                                      <button
                                        onClick={() => requestServiceOperationApproval(application, service, action)}
                                        disabled={isRequestingLive}
                                        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                                      >
                                        {isRequestingLive ? pendingLiveLabel : liveLabel}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                              <button
                                onClick={() => createDeploymentPlan(application, service)}
                              disabled={deployingServiceId === service.id}
                              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                            >
                                {deployingServiceId === service.id
                                  ? (queueDeploymentRuns ? '入队中...' : '生成中...')
                                  : (queueDeploymentRuns ? '加入部署队列' : '生成部署计划')}
                              </button>
                            </div>
                          </div>
                          {service.operationRuns && service.operationRuns.length > 0 && (
                            <div className="mt-3 rounded-md bg-muted/50 p-3">
                              <div className="text-xs font-medium text-muted-foreground">最近操作</div>
                              <div className="mt-2 space-y-2">
                                {service.operationRuns.slice(0, 3).map((run) => (
                                  <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium">{operationLabels[run.action] || run.action}</span>
                                      <OperationStatusBadge status={run.status} />
                                      <span className="text-muted-foreground">{run.dryRun ? 'Dry-run' : 'Live'}</span>
                                      {run.serverExecutionJob && (
                                        <Link href="/execution-governance" className="text-primary hover:underline">
                                          Job {run.serverExecutionJob.id.slice(0, 8)} · {getOperationStatusLabel(run.serverExecutionJob.status)}
                                        </Link>
                                      )}
                                      {run.error && <span className="text-destructive">{run.error}</span>}
                                    </div>
                                    <span className="text-muted-foreground">{formatDate(run.startedAt)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className = status === 'active'
    ? 'bg-green-100 text-green-700'
    : status === 'inactive'
      ? 'bg-gray-100 text-gray-700'
      : 'bg-yellow-100 text-yellow-700';
  const labels: Record<string, string> = {
    active: '启用',
    inactive: '停用',
    archived: '归档',
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${className}`}>
      {labels[status] || status}
    </span>
  );
}

function OperationStatusBadge({ status }: { status: string }) {
  const className = status === 'queued'
    ? 'bg-blue-100 text-blue-700'
    : status === 'completed'
      ? 'bg-green-100 text-green-700'
      : status === 'failed'
        ? 'bg-red-100 text-red-700'
        : status === 'blocked'
          ? 'bg-yellow-100 text-yellow-700'
          : 'bg-muted text-muted-foreground';
  return (
    <span className={`rounded-full px-2 py-0.5 ${className}`}>
      {getOperationStatusLabel(status)}
    </span>
  );
}

function getOperationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: '已入队',
    running: '运行中',
    completed: '完成',
    failed: '失败',
    blocked: '阻塞',
  };

  return labels[status] || status;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function compactObject(input: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value.trim().length > 0),
  );
}
