/**
 * 应用服务数据 Hook
 *
 * 单一职责：加载应用/项目/环境/服务器/站点/资源，计算统计，提供创建。
 * 操作（部署/服务操作/审批）委托 use-application-operations。
 */

import { useEffect, useMemo, useState } from 'react';
import { useSetState, usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
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
import { compactObject } from '../utils';
import { useApplicationOperations } from './use-application-operations';
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
  const [appForm, setAppForm] = useSetState<AppForm>(INITIAL_APP_FORM);
  const [serviceForm, setServiceForm] = useSetState<ServiceForm>(INITIAL_SERVICE_FORM);

  const load = usePersistFn(async () => {
    setError('');
    try {
      const [appData, projectData, envData, serverData, siteData, resourceData] = await Promise.all(
        [
          apiRequest<ApplicationItem[]>('GET:/applications'),
          apiRequest<Project[]>('GET:/projects'),
          apiRequest<ProjectEnvironment[]>('GET:/project-environments', { status: 'active' }),
          apiRequest<Server[]>('GET:/servers'),
          apiRequest<Site[]>('GET:/sites'),
          apiRequest<ManagedResource[]>('GET:/resource-control/resources'),
        ],
      );
      setApplications(appData);
      setProjects(projectData);
      setEnvironments(envData);
      setServers(serverData);
      setSites(siteData);
      setResources(resourceData);

      const preferredApp =
        (queryProjectId ? appData.filter((a) => a.projectId === queryProjectId) : appData)[0] ||
        appData[0];
      const preferredEnv =
        queryEnvironmentId ||
        preferredApp?.services[0]?.environment.id ||
        envData.find((e) => e.project?.id === queryProjectId)?.id ||
        '';
      setAppForm({ projectId: queryProjectId || projectData[0]?.id || '' });
      setServiceForm({
        applicationId: queryProjectId
          ? appData.some(
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

  const createApplication = usePersistFn(async () => {
    if (!appForm.projectId || !appForm.name.trim()) {
      alert('请选择项目并填写应用名称');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const application = await apiRequest<ApplicationItem>('POST:/applications', {
        projectId: appForm.projectId,
        name: appForm.name.trim(),
        repositoryUrl: appForm.repositoryUrl || undefined,
        defaultBranch: appForm.defaultBranch || undefined,
        repoPath: appForm.repoPath || undefined,
      });
      setAppForm({ name: '', repoPath: '' });
      setServiceForm({ applicationId: application.id });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建应用失败');
    } finally {
      setSaving(false);
    }
  });

  const createService = usePersistFn(async () => {
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
      await apiRequest(`POST:/applications/${serviceForm.applicationId}/services`, {
        environmentId: serviceForm.environmentId,
        name: serviceForm.name.trim(),
        kind: serviceForm.kind,
        runtime: serviceForm.runtime || undefined,
        serverId: serviceForm.serverId || undefined,
        siteId: serviceForm.siteId || undefined,
        managedResourceId: serviceForm.managedResourceId || undefined,
        deployConfig: Object.keys(deployConfig).length > 0 ? deployConfig : undefined,
      });
      setServiceForm({
        name: '',
        runtime: '',
        siteId: '',
        managedResourceId: '',
        workingDirectory: '',
        buildCommand: '',
        deployCommand: '',
        healthCheckUrl: '',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建应用服务失败');
    } finally {
      setSaving(false);
    }
  });

  const operations = useApplicationOperations({
    queueDeploymentRuns,
    queueServiceOperations,
    setDeployingServiceId,
    setRunningOperation,
    setError,
    reload: load,
  });

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
    error,
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
