/**
 * 应用服务数据 Hook
 *
 * 单一职责：加载应用/项目/环境/服务器/站点/资源，计算统计与过滤视图，并提供
 * 创建应用/创建服务（参数化）与操作回调。
 * 表单状态不再在此持有（迁移至弹窗）；URL 查询参数仅用于过滤列表与默认值建议。
 */

import { useEffect, useMemo, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { usePollingList } from '@/hooks/use-polling-list';
import type {
  ApplicationItem,
  Project,
  ProjectEnvironment,
  Server,
  Site,
  ManagedResource,
  AppStats,
} from '../types';
import { useApplicationOperations } from './use-application-operations';
import { useApplicationCreation } from './use-application-creation.hooks';
import { useApplicationServiceSlos } from './use-application-service-slos';

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
  const [deployingServiceId, setDeployingServiceId] = useState('');
  const [queueDeploymentRuns, setQueueDeploymentRuns] = useState(false);
  const [queueServiceOperations, setQueueServiceOperations] = useState(false);
  const [runningOperation, setRunningOperation] = useState('');
  const [error, setError] = useState('');

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
      setProjects(projectData);
      setEnvironments(envData);
      setServers(serverData);
      setSites(siteData);
      setResources(resourceData);
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

  const { createApplication, createService } = useApplicationCreation({ reload: load });

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
    deployingServiceId,
    queueDeploymentRuns,
    setQueueDeploymentRuns,
    queueServiceOperations,
    setQueueServiceOperations,
    runningOperation,
    error: errorMessage,
    defaultProjectId: queryProjectId || projects[0]?.id || '',
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
