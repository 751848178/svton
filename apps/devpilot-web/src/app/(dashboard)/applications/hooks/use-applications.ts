/**
 * 应用服务数据 Hook
 *
 * 单一职责：加载应用/项目/环境/服务器/站点/资源，计算统计。
 * 创建与操作分别委托 use-application-creation / use-application-operations。
 */

import { useEffect, useMemo, useState } from 'react';
import { useSetState, usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { usePollingList } from '@/hooks/use-polling-list';
import type {
  ApplicationItem,
  Project,
  ProjectEnvironment,
  Server,
  Site,
  ManagedResource,
  AppForm,
  ServiceForm,
  AppStats,
} from '../types';
import { useApplicationOperations } from './use-application-operations';
import { useApplicationCreation } from './use-application-creation.hooks';
import { useApplicationServiceSlos } from './use-application-service-slos';

const INITIAL_APP_FORM: AppForm = {
  projectId: '',
  name: '',
  repositoryUrl: '',
  defaultBranch: 'main',
  repoPath: '',
};
const INITIAL_SERVICE_FORM: ServiceForm = {
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
};

export function useApplications(queryProjectId: string, queryEnvironmentId: string) {
  // 应用列表内嵌各服务 operationRuns（GET:/applications），存在 queued/running 操作运行时
  // 由 usePollingList 数据驱动保持 5s 轮询，全部终态后自动停止。
  const applicationsSWR = usePollingList<ApplicationItem>(
    'GET:/applications',
    () => apiRequest<ApplicationItem[]>('GET:/applications'),
    {
      isActive: (app) =>
        app.services?.some((s) =>
          s.operationRuns?.some((r) => r.status === 'queued' || r.status === 'running'),
        ) ?? false,
      interval: 5000,
    },
  );
  const applications = useMemo(() => applicationsSWR.data ?? [], [applicationsSWR.data]);
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
  const [appForm, setAppForm] = useSetState<AppForm>(INITIAL_APP_FORM);
  const [serviceForm, setServiceForm] = useSetState<ServiceForm>(INITIAL_SERVICE_FORM);

  const load = usePersistFn(async () => {
    setError('');
    try {
      // mutate() 复用 SWR 缓存与去重：手动 reload 与轮询不会双份请求。
      const [appData, projectData, envData, serverData, siteData, resourceData] = await Promise.all(
        [
          applicationsSWR.mutate(),
          apiRequest<Project[]>('GET:/projects'),
          apiRequest<ProjectEnvironment[]>('GET:/project-environments', { status: 'active' }),
          apiRequest<Server[]>('GET:/servers'),
          apiRequest<Site[]>('GET:/sites'),
          apiRequest<ManagedResource[]>('GET:/resource-control/resources'),
        ],
      );
      const appList = appData ?? applicationsSWR.data ?? [];
      setProjects(projectData);
      setEnvironments(envData);
      setServers(serverData);
      setSites(siteData);
      setResources(resourceData);

      const preferredApp =
        (queryProjectId ? appList.filter((a) => a.projectId === queryProjectId) : appList)[0] ||
        appList[0];
      const preferredEnv =
        queryEnvironmentId ||
        preferredApp?.services[0]?.environment.id ||
        envData.find((e) => e.project?.id === queryProjectId)?.id ||
        '';
      setAppForm({ projectId: queryProjectId || projectData[0]?.id || '' });
      setServiceForm({
        applicationId: queryProjectId
          ? appList.some(
              (a) => a.id === serviceForm.applicationId && a.projectId === queryProjectId,
            )
            ? serviceForm.applicationId
            : preferredApp?.id || ''
          : serviceForm.applicationId || preferredApp?.id || '',
        environmentId: queryEnvironmentId || serviceForm.environmentId || preferredEnv,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载应用服务数据失败');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    load();
  }, [queryProjectId, queryEnvironmentId, load]);

  const visibleApplications = useMemo(
    () =>
      applications
        .filter((a) => !queryProjectId || a.projectId === queryProjectId)
        .map((a) => ({
          ...a,
          services: queryEnvironmentId
            ? a.services.filter((s) => s.environment?.id === queryEnvironmentId)
            : a.services,
        })),
    [applications, queryEnvironmentId, queryProjectId],
  );

  const stats = useMemo<AppStats>(() => {
    const services = visibleApplications.flatMap((a) => a.services || []);
    return {
      applications: visibleApplications.length,
      services: services.length,
      environments: new Set(services.map((s) => s.environment?.id).filter(Boolean)).size,
      deployments: services.reduce((sum, s) => sum + (s._count?.deploymentRuns || 0), 0),
      operations: services.reduce((sum, s) => sum + (s._count?.operationRuns || 0), 0),
    };
  }, [visibleApplications]);
  const visibleServiceIds = useMemo(
    () => visibleApplications.flatMap((a) => a.services.map((s) => s.id)),
    [visibleApplications],
  );
  const { serviceSloRows, serviceSloLoading, serviceSloError } =
    useApplicationServiceSlos(visibleServiceIds);

  const { createApplication, createService } = useApplicationCreation({
    appForm,
    serviceForm,
    setAppForm,
    setServiceForm,
    setSaving,
    setError,
    reload: load,
  });

  const operations = useApplicationOperations({
    queueDeploymentRuns,
    queueServiceOperations,
    setDeployingServiceId,
    setRunningOperation,
    setError,
    reload: load,
  });

  // 手动 load 的错误与轮询期间的 SWR 错误合并为一个 string，保持原有 error 导出语义。
  const errorMessage = error || (applicationsSWR.error ? applicationsSWR.error.message : '');

  return {
    applications,
    projects,
    environments,
    servers,
    sites,
    resources,
    loading,
    saving,
    deployingServiceId,
    queueDeploymentRuns,
    setQueueDeploymentRuns,
    queueServiceOperations,
    setQueueServiceOperations,
    runningOperation,
    error: errorMessage,
    appForm,
    setAppForm,
    serviceForm,
    setServiceForm,
    visibleApplications,
    stats,
    serviceSloRows,
    serviceSloLoading,
    serviceSloError,
    createApplication,
    createService,
    ...operations,
    reload: load,
  };
}
