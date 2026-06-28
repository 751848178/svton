'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  getProjectBranch,
  getProjectDescription,
  getProjectDeploymentConfig,
  getProjectEnvironmentLabels,
  getProjectManagementScope,
  getProjectManagementScopeLabel,
  getProjectOriginLabel,
  getProjectRepository,
  getProjectStackTags,
  getProjectSubProjectLabels,
  isGeneratedProject,
  toProjectConfigRecord,
} from '@/lib/project-display';

interface Project {
  id: string;
  name: string;
  description: string | null;
  gitRepo: string | null;
  config: unknown;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string | null; email: string };
  environments?: Array<{
    id: string;
    key: string;
    name: string;
    status: string;
    sortOrder: number;
    _count?: {
      serverBindings: number;
      sites: number;
      deploymentRuns: number;
      managedResources: number;
      resourceRequests: number;
      resourceInstances: number;
      cdnConfigs: number;
      secretKeys: number;
    };
    serverBindings?: Array<{
      id: string;
      role?: string | null;
      server: { id: string; name: string; host: string; status: string };
    }>;
  }>;
  sites?: Array<{
    id: string;
    name: string;
    primaryDomain: string;
    runtimeType: string;
    runtimeConfig?: Record<string, unknown> | null;
    tls?: Record<string, unknown> | null;
    status: string;
    environment?: { id: string; key: string; name: string; status: string } | null;
    server?: { id: string; name: string; host: string; status: string } | null;
    proxyConfig?: { id: string; name: string; domain: string; status: string } | null;
  }>;
  proxyConfigs?: Array<{ id: string; name: string; domain: string; status: string }>;
  cdnConfigs?: Array<{
    id: string;
    name: string;
    domain: string;
    origin: string;
    provider: string;
    credentialId?: string | null;
    cacheRules?: Array<{ path: string; ttl: number }> | null;
    status?: string;
    environment?: { id: string; key: string; name: string; status: string } | null;
  }>;
  managedResources?: Array<{
    id: string;
    sourceType: string;
    provider: string;
    kind: string;
    name: string;
    externalId: string;
    status: string;
    endpoint?: string | null;
    lastSyncAt?: string | null;
    environment?: { id: string; key: string; name: string; status: string } | null;
    server?: { id: string; name: string; host: string; status: string } | null;
    credential?: { id: string; name: string; type: string } | null;
  }>;
  resourceInstances?: Array<{
    id: string;
    name: string;
    status: string;
    expiresAt?: string | null;
    createdAt: string;
    projectEnvironment?: { id: string; key: string; name: string; status: string } | null;
    resourceType?: { id: string; key: string; name: string; category: string } | null;
    request?: { id: string; title: string; status: string } | null;
  }>;
  secretKeys?: Array<{
    id: string;
    name: string;
    type: string;
    description?: string | null;
    environment?: { id: string; key: string; name: string; status: string } | null;
    createdAt: string;
  }>;
  applications?: Array<{
    id: string;
    name: string;
    repositoryUrl?: string | null;
    defaultBranch?: string | null;
    services: Array<{
      id: string;
      name: string;
      kind: string;
      runtime?: string | null;
      deployConfig?: Record<string, unknown> | null;
      status: string;
      environment?: { id: string; key: string; name: string; status: string } | null;
      server?: { id: string; name: string; host: string; status: string } | null;
      site?: { id: string; name: string; primaryDomain: string; status: string } | null;
      managedResource?: { id: string; name: string; provider: string; kind: string; status: string } | null;
      _count?: { deploymentRuns: number; operationRuns: number };
    }>;
    _count?: { services: number; deploymentRuns: number; operationRuns: number };
  }>;
}

interface ProjectServerOption {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  status: 'online' | 'offline' | 'unknown' | string;
  services?: Record<string, boolean>;
  environmentBindings?: Array<{
    id: string;
    role?: string | null;
    projectId?: string | null;
    environmentId?: string | null;
    project?: { id: string; name: string } | null;
    environment?: { id: string; key: string; name: string; status: string } | null;
  }>;
}

interface TeamCredentialOption {
  id: string;
  type: string;
  name: string;
  createdAt: string;
}

interface DeploymentCommandStep {
  key: string;
  label: string;
  command: string;
  cwd: string;
  required: boolean;
}

interface DeploymentRun {
  id: string;
  environment: string | null;
  projectEnvironment?: { id: string; key: string; name: string; status: string } | null;
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
  operationApproval?: {
    id: string;
    status: string;
    risk: string;
    reviewedAt?: string | null;
    consumedAt?: string | null;
  } | null;
  targetType: string;
  dryRun: boolean;
  mode?: 'deploy' | 'rollback' | string;
  source: string;
  status: string;
  branch: string | null;
  commitSha: string | null;
  healthCheckUrl?: string | null;
  commandPlan: unknown;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  sourceRun?: {
    id: string;
    mode: string;
    status: string;
    branch: string | null;
    commitSha: string | null;
    startedAt: string;
  } | null;
  actor?: { id: string; name: string | null; email: string } | null;
}

interface ProjectWebhook {
  id: string;
  name: string;
  provider: string;
  urlToken: string;
  enabled: boolean;
  eventTypes: unknown;
  branchPattern: string | null;
  deploymentMode: 'dry_run' | 'queue' | 'live_request' | 'preview' | string;
  maxAttempts: number;
  environment?: { id: string; key: string; name: string; status: string } | null;
  lastDeliveryAt: string | null;
  createdAt: string;
  setupSecret?: string;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  signatureStatus: string;
  status: string;
  message: string | null;
  receivedAt: string;
  deploymentRun?: { id: string; status: string; dryRun: boolean } | null;
}

const deploymentTargetLabels: Record<string, string> = {
  'docker-compose': 'Docker Compose',
  server: '服务器脚本',
  kubernetes: 'Kubernetes',
  'external-ci': '外部 CI',
};

const resourceKindLabels: Record<string, string> = {
  docker_container: 'Docker 容器',
  mysql: 'MySQL',
  redis: 'Redis',
  database: '数据库',
  log_service: '日志服务',
  object_storage: '对象存储',
};

const resourceProviderLabels: Record<string, string> = {
  docker: 'Docker',
  'aliyun-rds': '阿里云 RDS',
  'aliyun-sls': '阿里云 SLS',
  'tencent-cos': '腾讯云 COS',
};

const serverRoleOptions = [
  { value: 'runtime', label: '运行服务' },
  { value: 'deploy', label: '部署执行' },
  { value: 'database', label: '数据库' },
  { value: 'edge', label: '边缘入口' },
  { value: 'mixed', label: '混合用途' },
] as const;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3101';

interface DeployConfigCoverage {
  total: number;
  workingDirectory: number;
  buildCommand: number;
  deployCommand: number;
  healthCheckUrl: number;
  rollbackCommand: number;
}

interface EnvironmentConfigProfile {
  environment: NonNullable<Project['environments']>[number];
  isReference: boolean;
  serviceKeys: string[];
  serverKeys: string[];
  resourceKindKeys: string[];
  siteRuntimeKeys: string[];
  secretTypeKeys: string[];
  siteCount: number;
  tlsSiteCount: number;
  serviceBindingGapCount: number;
  deployConfigCoverage: DeployConfigCoverage;
  successfulDeployments: number;
  differences: string[];
}

interface EnvironmentSyncSuggestionAction {
  kind: string;
  severity: 'info' | 'warning' | 'critical' | string;
  title: string;
  description: string;
  target: 'resource-control' | 'applications' | 'sites' | 'keys' | 'cdn-configs' | string;
  metadata?: Record<string, unknown>;
}

interface EnvironmentSyncSuggestionProfile {
  environment: { id: string; key: string; name: string; status: string; sortOrder: number };
  isReference: boolean;
  differenceLabels: string[];
  actions: EnvironmentSyncSuggestionAction[];
}

interface EnvironmentSyncSuggestions {
  projectId: string;
  referenceEnvironment: { id: string; key: string; name: string; status: string; sortOrder: number } | null;
  profiles: EnvironmentSyncSuggestionProfile[];
  summary: {
    environmentCount: number;
    actionCount: number;
    differenceCount: number;
  };
}

interface EnvironmentSyncApplyStep {
  kind: string;
  status: 'planned' | 'applied' | 'skipped' | string;
  title: string;
  description: string;
  targetType: string;
  sourceId?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

interface EnvironmentSyncApplyResult {
  projectId: string;
  sourceEnvironment: { id: string; key: string; name: string };
  targetEnvironment: { id: string; key: string; name: string };
  dryRun: boolean;
  status: string;
  plannedCount: number;
  appliedCount: number;
  skippedCount: number;
  steps: EnvironmentSyncApplyStep[];
  warnings: string[];
}

interface EnvironmentResourceBulkBindStep {
  type: 'managed_resource' | 'resource_instance' | 'site' | 'cdn_config' | 'secret_key' | string;
  status: 'planned' | 'applied' | 'skipped' | string;
  resourceId: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

interface EnvironmentResourceBulkBindResult {
  projectId: string;
  environment: { id: string; key: string; name: string };
  dryRun: boolean;
  status: string;
  plannedCount: number;
  appliedCount: number;
  skippedCount: number;
  steps: EnvironmentResourceBulkBindStep[];
  summary: {
    managedResources: number;
    resourceInstances: number;
    sites: number;
    cdnConfigs: number;
    secretKeys: number;
  };
  warnings: string[];
}

interface EnvironmentSiteCopyStep {
  status: 'planned' | 'applied' | 'skipped' | string;
  sourceSiteId: string;
  targetSiteId?: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

interface EnvironmentSiteCopyResult {
  projectId: string;
  sourceEnvironment: { id: string; key: string; name: string };
  targetEnvironment: { id: string; key: string; name: string };
  dryRun: boolean;
  status: string;
  plannedCount: number;
  appliedCount: number;
  skippedCount: number;
  steps: EnvironmentSiteCopyStep[];
  warnings: string[];
}

interface EnvironmentCdnConfigCopyStep {
  status: 'planned' | 'applied' | 'skipped' | string;
  sourceCdnConfigId: string;
  targetCdnConfigId?: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

interface EnvironmentCdnConfigCopyResult {
  projectId: string;
  sourceEnvironment: { id: string; key: string; name: string };
  targetEnvironment: { id: string; key: string; name: string };
  dryRun: boolean;
  status: string;
  plannedCount: number;
  appliedCount: number;
  skippedCount: number;
  steps: EnvironmentCdnConfigCopyStep[];
  warnings: string[];
}

interface EnvironmentResourceCopyStep {
  type: 'managed_resource' | 'secret_key' | string;
  status: 'planned' | 'applied' | 'skipped' | string;
  sourceId: string;
  targetId?: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

interface EnvironmentResourceCopyResult {
  projectId: string;
  sourceEnvironment: { id: string; key: string; name: string };
  targetEnvironment: { id: string; key: string; name: string };
  dryRun: boolean;
  status: string;
  plannedCount: number;
  appliedCount: number;
  skippedCount: number;
  steps: EnvironmentResourceCopyStep[];
  warnings: string[];
}

type EnvironmentResourceBulkBindType = 'managed_resource' | 'resource_instance' | 'site' | 'cdn_config' | 'secret_key';

type EnvironmentResourceBulkBindSelectionKey =
  | 'managedResourceIds'
  | 'resourceInstanceIds'
  | 'siteIds'
  | 'cdnConfigIds'
  | 'secretKeyIds';

type WebhookTriggerMode = 'push' | 'pr_preview';
type WebhookDeploymentMode = 'dry_run' | 'queue' | 'live_request' | 'preview';

interface EnvironmentResourceBulkBindSelection {
  managedResourceIds: string[];
  resourceInstanceIds: string[];
  siteIds: string[];
  cdnConfigIds: string[];
  secretKeyIds: string[];
}

type ProjectServiceWithApplication = NonNullable<Project['applications']>[number]['services'][number] & {
  applicationName: string;
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [servers, setServers] = useState<ProjectServerOption[]>([]);
  const [teamCredentials, setTeamCredentials] = useState<TeamCredentialOption[]>([]);
  const [deploymentRuns, setDeploymentRuns] = useState<DeploymentRun[]>([]);
  const [creatingDeploymentRun, setCreatingDeploymentRun] = useState(false);
  const [requestingLiveDeployment, setRequestingLiveDeployment] = useState(false);
  const [queueDeploymentRun, setQueueDeploymentRun] = useState(false);
  const [smokeAutoRollbackOnFailure, setSmokeAutoRollbackOnFailure] = useState(false);
  const [postRollbackSmokeOnSuccess, setPostRollbackSmokeOnSuccess] = useState(false);
  const [rollingBackRunId, setRollingBackRunId] = useState('');
  const [requestingLiveRollbackRunId, setRequestingLiveRollbackRunId] = useState('');
  const [requestingFailureRollbackRunId, setRequestingFailureRollbackRunId] = useState('');
  const [requestingSmokeFailureRollbackRunId, setRequestingSmokeFailureRollbackRunId] = useState('');
  const [retryingDeploymentRunId, setRetryingDeploymentRunId] = useState('');
  const [requestingLiveRetryRunId, setRequestingLiveRetryRunId] = useState('');
  const [smokeCheckingRunId, setSmokeCheckingRunId] = useState('');
  const [executingLiveSmokeRunId, setExecutingLiveSmokeRunId] = useState('');
  const [webhooks, setWebhooks] = useState<ProjectWebhook[]>([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDelivery[]>([]);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState('');
  const [rotatingWebhookId, setRotatingWebhookId] = useState('');
  const [rotatedWebhookSecret, setRotatedWebhookSecret] = useState<{ webhookId: string; secret: string } | null>(null);
  const [webhookEnvironmentId, setWebhookEnvironmentId] = useState('');
  const [webhookTriggerMode, setWebhookTriggerMode] = useState<WebhookTriggerMode>('push');
  const [webhookDeploymentMode, setWebhookDeploymentMode] = useState<WebhookDeploymentMode>('dry_run');
  const [webhookMaxAttempts, setWebhookMaxAttempts] = useState(1);
  const [environmentSyncSuggestions, setEnvironmentSyncSuggestions] = useState<EnvironmentSyncSuggestions | null>(null);
  const [environmentSyncApplyResults, setEnvironmentSyncApplyResults] = useState<Record<string, EnvironmentSyncApplyResult>>({});
  const [runningEnvironmentSyncId, setRunningEnvironmentSyncId] = useState('');
  const [environmentResourceBindResults, setEnvironmentResourceBindResults] = useState<Record<string, EnvironmentResourceBulkBindResult>>({});
  const [runningResourceBindId, setRunningResourceBindId] = useState('');
  const [resourceBulkBindSelection, setResourceBulkBindSelection] = useState<EnvironmentResourceBulkBindSelection>(
    createEmptyResourceBulkBindSelection,
  );
  const [siteCopySourceEnvironmentId, setSiteCopySourceEnvironmentId] = useState('');
  const [siteCopyDomainOverrides, setSiteCopyDomainOverrides] = useState<Record<string, string>>({});
  const [siteCopyResults, setSiteCopyResults] = useState<Record<string, EnvironmentSiteCopyResult>>({});
  const [runningSiteCopyId, setRunningSiteCopyId] = useState('');
  const [postCopyPlanningSiteId, setPostCopyPlanningSiteId] = useState('');
  const [postCopyTlsProbingSiteId, setPostCopyTlsProbingSiteId] = useState('');
  const [cdnCopySourceEnvironmentId, setCdnCopySourceEnvironmentId] = useState('');
  const [cdnCopyDomainOverrides, setCdnCopyDomainOverrides] = useState<Record<string, string>>({});
  const [cdnCopyOriginOverrides, setCdnCopyOriginOverrides] = useState<Record<string, string>>({});
  const [cdnCopyCredentialIds, setCdnCopyCredentialIds] = useState<Record<string, string>>({});
  const [cdnCopyResults, setCdnCopyResults] = useState<Record<string, EnvironmentCdnConfigCopyResult>>({});
  const [runningCdnCopyId, setRunningCdnCopyId] = useState('');
  const [resourceCopySourceEnvironmentId, setResourceCopySourceEnvironmentId] = useState('');
  const [resourceCopyExternalIds, setResourceCopyExternalIds] = useState<Record<string, string>>({});
  const [resourceCopyNames, setResourceCopyNames] = useState<Record<string, string>>({});
  const [resourceCopyEndpoints, setResourceCopyEndpoints] = useState<Record<string, string>>({});
  const [resourceCopyServerIds, setResourceCopyServerIds] = useState<Record<string, string>>({});
  const [resourceCopyCredentialIds, setResourceCopyCredentialIds] = useState<Record<string, string>>({});
  const [secretCopyNames, setSecretCopyNames] = useState<Record<string, string>>({});
  const [secretCopyValues, setSecretCopyValues] = useState<Record<string, string>>({});
  const [secretCopyDescriptions, setSecretCopyDescriptions] = useState<Record<string, string>>({});
  const [resourceCopyResults, setResourceCopyResults] = useState<Record<string, EnvironmentResourceCopyResult>>({});
  const [runningResourceCopyId, setRunningResourceCopyId] = useState('');
  const [postCopyProbingResourceId, setPostCopyProbingResourceId] = useState('');
  const [serverBindingServerId, setServerBindingServerId] = useState('');
  const [serverBindingRole, setServerBindingRole] = useState<(typeof serverRoleOptions)[number]['value']>('runtime');
  const [bindingServerId, setBindingServerId] = useState('');
  const [unbindingServerId, setUnbindingServerId] = useState('');
  const [syncingEnvironments, setSyncingEnvironments] = useState(false);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');

  useEffect(() => {
    loadProject();
    loadServers();
    loadTeamCredentials();
    loadEnvironmentSyncSuggestions();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const data = await api.get<Project>(`/projects/${projectId}`);
      setProject(data);
      setEditForm({
        name: data.name,
        description: getProjectDescription(data.config, data.description),
      });
      setWebhookEnvironmentId((current) => current || data.environments?.find((environment) => environment.status === 'active')?.id || '');
      setSelectedEnvironmentId((current) => current || data.environments?.find((environment) => environment.status === 'active')?.id || data.environments?.[0]?.id || '');
      setResourceBulkBindSelection(createResourceBulkBindSelection(data));
      loadDeploymentRuns();
      loadProjectWebhooks();
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEnvironmentSyncSuggestions = async () => {
    try {
      const data = await api.get<EnvironmentSyncSuggestions>('/project-environments/sync-suggestions', {
        params: { projectId },
      });
      setEnvironmentSyncSuggestions(data);
    } catch (error) {
      console.error('Failed to load environment sync suggestions:', error);
      setEnvironmentSyncSuggestions(null);
    }
  };

  const loadServers = async () => {
    try {
      const data = await api.get<ProjectServerOption[]>('/servers');
      setServers(data);
    } catch (error) {
      console.error('Failed to load servers:', error);
      setServers([]);
    }
  };

  const loadTeamCredentials = async () => {
    try {
      const data = await api.get<TeamCredentialOption[]>('/team-credentials');
      setTeamCredentials(data);
    } catch (error) {
      console.error('Failed to load team credentials:', error);
      setTeamCredentials([]);
    }
  };

  const handleEnvironmentSyncApply = async (
    targetEnvironment: EnvironmentSyncSuggestionProfile['environment'],
    dryRun: boolean,
  ) => {
    const referenceEnvironment = environmentSyncSuggestions?.referenceEnvironment;
    if (!referenceEnvironment) {
      alert('缺少参考环境，无法生成同步计划');
      return;
    }
    if (referenceEnvironment.id === targetEnvironment.id) {
      return;
    }

    let confirmationText: string | undefined;
    if (!dryRun) {
      const input = prompt(`只会创建缺失服务骨架并补齐非敏感部署配置，不会复制服务器、站点、资源、CDN 或密钥绑定。请输入目标环境名称或 key 确认：${targetEnvironment.name} / ${targetEnvironment.key}`);
      if (input === null) {
        return;
      }
      confirmationText = input.trim();
    }

    setRunningEnvironmentSyncId(`${targetEnvironment.id}:${dryRun ? 'plan' : 'apply'}`);
    try {
      const result = await api.post<EnvironmentSyncApplyResult>('/project-environments/sync-suggestions/apply', {
        projectId,
        sourceEnvironmentId: referenceEnvironment.id,
        targetEnvironmentId: targetEnvironment.id,
        dryRun,
        confirmationText,
      });
      setEnvironmentSyncApplyResults((current) => ({
        ...current,
        [targetEnvironment.id]: result,
      }));
      if (!dryRun) {
        await Promise.all([loadProject(), loadEnvironmentSyncSuggestions()]);
      }
    } catch (error) {
      console.error('Failed to apply environment sync suggestions:', error);
      alert(error instanceof Error ? error.message : '环境同步计划执行失败');
    } finally {
      setRunningEnvironmentSyncId('');
    }
  };

  const handleEnvironmentResourceBulkBind = async (
    targetEnvironment: NonNullable<Project['environments']>[number],
    dryRun: boolean,
  ) => {
    const selectedCount = countResourceBulkBindSelection(resourceBulkBindSelection);
    if (selectedCount === 0) {
      alert('请先选择要绑定到环境的资源');
      return;
    }

    const bindingScope = buildResourceBulkBindRequest(resourceBulkBindSelection);
    let confirmationText: string | undefined;
    if (!dryRun) {
      const input = prompt(`将把已选择的 ${selectedCount} 个项目资源归属到目标环境，不会复制或修改实际资源/密钥值。请输入目标环境名称或 key 确认：${targetEnvironment.name} / ${targetEnvironment.key}`);
      if (input === null) {
        return;
      }
      confirmationText = input.trim();
    }

    setRunningResourceBindId(`${targetEnvironment.id}:${dryRun ? 'plan' : 'apply'}`);
    try {
      const result = await api.post<EnvironmentResourceBulkBindResult>('/project-environments/resources/bulk-bind', {
        projectId,
        environmentId: targetEnvironment.id,
        dryRun,
        resourceTypes: bindingScope.resourceTypes,
        resourceIds: bindingScope.resourceIds,
        confirmationText,
      });
      setEnvironmentResourceBindResults((current) => ({
        ...current,
        [targetEnvironment.id]: result,
      }));
      if (!dryRun) {
        await Promise.all([loadProject(), loadEnvironmentSyncSuggestions()]);
      }
    } catch (error) {
      console.error('Failed to bulk bind environment resources:', error);
      alert(error instanceof Error ? error.message : '批量绑定环境资源失败');
    } finally {
      setRunningResourceBindId('');
    }
  };

  const handleToggleResourceBulkBindSelection = (
    key: EnvironmentResourceBulkBindSelectionKey,
    resourceId: string,
    selected: boolean,
  ) => {
    setResourceBulkBindSelection((current) => toggleResourceBulkBindSelection(current, key, resourceId, selected));
  };

  const handleSelectAllUnboundResources = () => {
    if (!project) return;
    setResourceBulkBindSelection(createResourceBulkBindSelection(project));
  };

  const handleClearResourceBulkBindSelection = () => {
    setResourceBulkBindSelection(createEmptyResourceBulkBindSelection());
  };

  const handleSiteCopyDomainChange = (siteId: string, domain: string) => {
    setSiteCopyDomainOverrides((current) => {
      const next = { ...current };
      if (domain) {
        next[siteId] = domain;
      } else {
        delete next[siteId];
      }
      return next;
    });
  };

  const handleEnvironmentSiteCopy = async (dryRun: boolean) => {
    if (!selectedEnvironment || !siteCopySourceEnvironment) return;
    if (selectedEnvironment.id === siteCopySourceEnvironment.id) {
      alert('源环境和目标环境不能相同');
      return;
    }

    const selectedSourceSites = sourceSiteCopySites.filter((site) => siteCopyDomainOverrides[site.id]?.trim());
    if (selectedSourceSites.length === 0) {
      alert('请先为至少一个源站点填写目标域名');
      return;
    }

    const targetDomainOverrides = selectedSourceSites.reduce<Record<string, string>>((acc, site) => {
      acc[site.id] = siteCopyDomainOverrides[site.id].trim();
      return acc;
    }, {});

    let confirmationText: string | undefined;
    if (!dryRun) {
      const input = prompt(`将从 ${siteCopySourceEnvironment.name} 复制 ${selectedSourceSites.length} 个站点到 ${selectedEnvironment.name}，只创建 draft 站点，不绑定服务器或真实证书。请输入目标环境名称或 key 确认：${selectedEnvironment.name} / ${selectedEnvironment.key}`);
      if (input === null) {
        return;
      }
      confirmationText = input.trim();
    }

    const resultKey = buildSiteCopyResultKey(siteCopySourceEnvironment.id, selectedEnvironment.id);
    setRunningSiteCopyId(`${resultKey}:${dryRun ? 'plan' : 'apply'}`);
    try {
      const result = await api.post<EnvironmentSiteCopyResult>('/project-environments/sites/copy', {
        projectId,
        sourceEnvironmentId: siteCopySourceEnvironment.id,
        targetEnvironmentId: selectedEnvironment.id,
        siteIds: selectedSourceSites.map((site) => site.id),
        targetDomainOverrides,
        dryRun,
        confirmationText,
      });
      setSiteCopyResults((current) => ({
        ...current,
        [resultKey]: result,
      }));
      if (!dryRun) {
        await Promise.all([loadProject(), loadEnvironmentSyncSuggestions()]);
      }
    } catch (error) {
      console.error('Failed to copy environment sites:', error);
      alert(error instanceof Error ? error.message : '跨环境复制站点失败');
    } finally {
      setRunningSiteCopyId('');
    }
  };

  const handlePostCopySiteSyncPlan = async (siteId: string) => {
    if (!siteId) return;

    setPostCopyPlanningSiteId(siteId);
    try {
      await api.post(`/sites/${siteId}/sync-plan`, {
        dryRun: true,
        queue: false,
      });
      alert('已生成 Nginx/OpenResty 同步计划，可在站点管控详情中查看');
    } catch (error) {
      console.error('Failed to create post-copy site sync plan:', error);
      alert(error instanceof Error ? error.message : '生成站点同步计划失败');
    } finally {
      setPostCopyPlanningSiteId('');
    }
  };

  const handlePostCopySiteTlsProbe = async (siteId: string) => {
    if (!siteId) return;

    setPostCopyTlsProbingSiteId(siteId);
    try {
      await api.post(`/sites/${siteId}/tls-probe`, {
        dryRun: true,
        queue: false,
      });
      alert('已生成 TLS 探测计划，可在站点管控详情中查看');
    } catch (error) {
      console.error('Failed to create post-copy site TLS probe plan:', error);
      alert(error instanceof Error ? error.message : '生成 TLS 探测计划失败');
    } finally {
      setPostCopyTlsProbingSiteId('');
    }
  };

  const handleCdnCopyFieldChange = (
    field: 'domain' | 'origin' | 'credential',
    cdnConfigId: string,
    value: string,
  ) => {
    const updater = (current: Record<string, string>) => {
      const next = { ...current };
      if (value) {
        next[cdnConfigId] = value;
      } else {
        delete next[cdnConfigId];
      }
      return next;
    };

    if (field === 'domain') {
      setCdnCopyDomainOverrides(updater);
    } else if (field === 'origin') {
      setCdnCopyOriginOverrides(updater);
    } else {
      setCdnCopyCredentialIds(updater);
    }
  };

  const handleEnvironmentCdnConfigCopy = async (dryRun: boolean) => {
    if (!selectedEnvironment || !cdnCopySourceEnvironment) return;
    if (selectedEnvironment.id === cdnCopySourceEnvironment.id) {
      alert('源环境和目标环境不能相同');
      return;
    }

    const selectedSourceConfigs = sourceCdnCopyConfigs.filter((config) =>
      cdnCopyDomainOverrides[config.id]?.trim() &&
      cdnCopyOriginOverrides[config.id]?.trim() &&
      cdnCopyCredentialIds[config.id]?.trim(),
    );
    if (selectedSourceConfigs.length === 0) {
      alert('请先为至少一个 CDN 配置填写目标域名、目标源站并选择目标凭据');
      return;
    }

    const targetDomainOverrides = selectedSourceConfigs.reduce<Record<string, string>>((acc, config) => {
      acc[config.id] = cdnCopyDomainOverrides[config.id].trim();
      return acc;
    }, {});
    const targetOriginOverrides = selectedSourceConfigs.reduce<Record<string, string>>((acc, config) => {
      acc[config.id] = cdnCopyOriginOverrides[config.id].trim();
      return acc;
    }, {});
    const targetCredentialIds = selectedSourceConfigs.reduce<Record<string, string>>((acc, config) => {
      acc[config.id] = cdnCopyCredentialIds[config.id].trim();
      return acc;
    }, {});

    let confirmationText: string | undefined;
    if (!dryRun) {
      const input = prompt(`将从 ${cdnCopySourceEnvironment.name} 复制 ${selectedSourceConfigs.length} 个 CDN 配置到 ${selectedEnvironment.name}，只创建 pending 配置，不调用云 provider。请输入目标环境名称或 key 确认：${selectedEnvironment.name} / ${selectedEnvironment.key}`);
      if (input === null) {
        return;
      }
      confirmationText = input.trim();
    }

    const resultKey = buildCopyResultKey(cdnCopySourceEnvironment.id, selectedEnvironment.id);
    setRunningCdnCopyId(`${resultKey}:${dryRun ? 'plan' : 'apply'}`);
    try {
      const result = await api.post<EnvironmentCdnConfigCopyResult>('/project-environments/cdn-configs/copy', {
        projectId,
        sourceEnvironmentId: cdnCopySourceEnvironment.id,
        targetEnvironmentId: selectedEnvironment.id,
        cdnConfigIds: selectedSourceConfigs.map((config) => config.id),
        targetDomainOverrides,
        targetOriginOverrides,
        targetCredentialIds,
        dryRun,
        confirmationText,
      });
      setCdnCopyResults((current) => ({
        ...current,
        [resultKey]: result,
      }));
      if (!dryRun) {
        await Promise.all([loadProject(), loadEnvironmentSyncSuggestions()]);
      }
    } catch (error) {
      console.error('Failed to copy environment CDN configs:', error);
      alert(error instanceof Error ? error.message : '跨环境复制 CDN 配置失败');
    } finally {
      setRunningCdnCopyId('');
    }
  };

  const handleResourceCopyFieldChange = (
    field:
      | 'externalId'
      | 'name'
      | 'endpoint'
      | 'server'
      | 'credential'
      | 'secretName'
      | 'secretValue'
      | 'secretDescription',
    itemId: string,
    value: string,
  ) => {
    const updater = (current: Record<string, string>) => {
      const next = { ...current };
      if (value) {
        next[itemId] = value;
      } else {
        delete next[itemId];
      }
      return next;
    };

    if (field === 'externalId') {
      setResourceCopyExternalIds(updater);
    } else if (field === 'name') {
      setResourceCopyNames(updater);
    } else if (field === 'endpoint') {
      setResourceCopyEndpoints(updater);
    } else if (field === 'server') {
      setResourceCopyServerIds(updater);
    } else if (field === 'credential') {
      setResourceCopyCredentialIds(updater);
    } else if (field === 'secretName') {
      setSecretCopyNames(updater);
    } else if (field === 'secretValue') {
      setSecretCopyValues(updater);
    } else {
      setSecretCopyDescriptions(updater);
    }
  };

  const handleEnvironmentResourceCopy = async (dryRun: boolean) => {
    if (!selectedEnvironment || !resourceCopySourceEnvironment) return;
    if (selectedEnvironment.id === resourceCopySourceEnvironment.id) {
      alert('源环境和目标环境不能相同');
      return;
    }

    const selectedSourceResources = sourceResourceCopyManagedResources.filter((resource) =>
      resourceCopyExternalIds[resource.id]?.trim(),
    );
    const selectedSourceSecrets = sourceResourceCopySecretKeys.filter((secret) =>
      typeof secretCopyValues[secret.id] === 'string' && secretCopyValues[secret.id].length > 0,
    );
    const selectedCount = selectedSourceResources.length + selectedSourceSecrets.length;
    if (selectedCount === 0) {
      alert('请先为至少一个资源填写目标 externalId，或为至少一个密钥填写新的目标值');
      return;
    }

    const targetResourceExternalIds = selectedSourceResources.reduce<Record<string, string>>((acc, resource) => {
      acc[resource.id] = resourceCopyExternalIds[resource.id].trim();
      return acc;
    }, {});
    const targetResourceNames = selectedSourceResources.reduce<Record<string, string>>((acc, resource) => {
      const value = resourceCopyNames[resource.id]?.trim();
      if (value) {
        acc[resource.id] = value;
      }
      return acc;
    }, {});
    const targetResourceEndpoints = selectedSourceResources.reduce<Record<string, string>>((acc, resource) => {
      const value = resourceCopyEndpoints[resource.id]?.trim();
      if (value) {
        acc[resource.id] = value;
      }
      return acc;
    }, {});
    const targetResourceServerIds = selectedSourceResources.reduce<Record<string, string>>((acc, resource) => {
      const value = resourceCopyServerIds[resource.id]?.trim();
      if (value) {
        acc[resource.id] = value;
      }
      return acc;
    }, {});
    const targetResourceCredentialIds = selectedSourceResources.reduce<Record<string, string>>((acc, resource) => {
      const value = resourceCopyCredentialIds[resource.id]?.trim();
      if (value) {
        acc[resource.id] = value;
      }
      return acc;
    }, {});
    const targetSecretNames = selectedSourceSecrets.reduce<Record<string, string>>((acc, secret) => {
      const value = secretCopyNames[secret.id]?.trim();
      if (value) {
        acc[secret.id] = value;
      }
      return acc;
    }, {});
    const targetSecretValues = selectedSourceSecrets.reduce<Record<string, string>>((acc, secret) => {
      acc[secret.id] = secretCopyValues[secret.id];
      return acc;
    }, {});
    const targetSecretDescriptions = selectedSourceSecrets.reduce<Record<string, string>>((acc, secret) => {
      const value = secretCopyDescriptions[secret.id];
      if (value) {
        acc[secret.id] = value;
      }
      return acc;
    }, {});

    let confirmationText: string | undefined;
    if (!dryRun) {
      const input = prompt(`将从 ${resourceCopySourceEnvironment.name} 复制 ${selectedSourceResources.length} 个资源和 ${selectedSourceSecrets.length} 个密钥到 ${selectedEnvironment.name}，只创建安全骨架，不读取源密钥值或操作真实外部资源。请输入目标环境名称或 key 确认：${selectedEnvironment.name} / ${selectedEnvironment.key}`);
      if (input === null) {
        return;
      }
      confirmationText = input.trim();
    }

    const resultKey = buildCopyResultKey(resourceCopySourceEnvironment.id, selectedEnvironment.id);
    setRunningResourceCopyId(`${resultKey}:${dryRun ? 'plan' : 'apply'}`);
    try {
      const result = await api.post<EnvironmentResourceCopyResult>('/project-environments/resources/copy', {
        projectId,
        sourceEnvironmentId: resourceCopySourceEnvironment.id,
        targetEnvironmentId: selectedEnvironment.id,
        managedResourceIds: selectedSourceResources.map((resource) => resource.id),
        secretKeyIds: selectedSourceSecrets.map((secret) => secret.id),
        targetResourceExternalIds,
        targetResourceNames,
        targetResourceEndpoints,
        targetResourceServerIds,
        targetResourceCredentialIds,
        targetSecretNames,
        targetSecretValues,
        targetSecretDescriptions,
        dryRun,
        confirmationText,
      });
      setResourceCopyResults((current) => ({
        ...current,
        [resultKey]: result,
      }));
      if (!dryRun) {
        setSecretCopyValues((current) => {
          const next = { ...current };
          selectedSourceSecrets.forEach((secret) => {
            delete next[secret.id];
          });
          return next;
        });
        await Promise.all([loadProject(), loadEnvironmentSyncSuggestions()]);
      }
    } catch (error) {
      console.error('Failed to copy environment resources and secrets:', error);
      alert(error instanceof Error ? error.message : '跨环境复制资源/密钥失败');
    } finally {
      setRunningResourceCopyId('');
    }
  };

  const handlePostCopyResourceProbe = async (resourceId: string) => {
    setPostCopyProbingResourceId(resourceId);
    try {
      await api.post(`/resource-control/resources/${resourceId}/connection-probe`, {
        dryRun: true,
      });
      alert('已生成连接探测计划，可在资源管控详情中查看结果');
    } catch (error) {
      console.error('Failed to create post-copy resource probe:', error);
      alert(error instanceof Error ? error.message : '生成连接探测计划失败');
    } finally {
      setPostCopyProbingResourceId('');
    }
  };

  const handleBindServerToEnvironment = async () => {
    if (!selectedEnvironment) return;
    if (!serverBindingServerId) {
      alert('请先选择要绑定的服务器');
      return;
    }

    const server = servers.find((item) => item.id === serverBindingServerId);
    const roleLabel = getServerRoleLabel(serverBindingRole);
    if (!confirm(`确认把服务器 ${server?.name || serverBindingServerId} 以“${roleLabel}”角色绑定到环境 ${selectedEnvironment.name}？`)) {
      return;
    }

    setBindingServerId(serverBindingServerId);
    try {
      await api.post(`/project-environments/${selectedEnvironment.id}/servers`, {
        serverId: serverBindingServerId,
        role: serverBindingRole,
        metadata: {
          source: 'project_environment_workspace',
        },
      });
      setServerBindingServerId('');
      await Promise.all([loadProject(), loadServers(), loadEnvironmentSyncSuggestions()]);
    } catch (error) {
      console.error('Failed to bind server:', error);
      alert(error instanceof Error ? error.message : '绑定服务器失败');
    } finally {
      setBindingServerId('');
    }
  };

  const handleUnbindServerFromEnvironment = async (
    binding: NonNullable<NonNullable<Project['environments']>[number]['serverBindings']>[number],
  ) => {
    if (!selectedEnvironment) return;
    if (!confirm(`确认从环境 ${selectedEnvironment.name} 解绑服务器 ${binding.server.name}？不会删除服务器本身。`)) {
      return;
    }

    setUnbindingServerId(binding.server.id);
    try {
      await api.delete(`/project-environments/${selectedEnvironment.id}/servers/${binding.server.id}`);
      await Promise.all([loadProject(), loadServers(), loadEnvironmentSyncSuggestions()]);
    } catch (error) {
      console.error('Failed to unbind server:', error);
      alert(error instanceof Error ? error.message : '解绑服务器失败');
    } finally {
      setUnbindingServerId('');
    }
  };

  const handleSave = async () => {
    if (!project) return;

    try {
      const config = toProjectConfigRecord(project.config);
      await api.put(`/projects/${projectId}`, {
        name: editForm.name,
        description: editForm.description,
        config: {
          ...config,
          projectName: editForm.name,
          description: editForm.description,
        },
      });
      setEditing(false);
      loadProject();
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const loadDeploymentRuns = async () => {
    try {
      const data = await api.get<DeploymentRun[]>('/deployments/runs', {
        params: { projectId },
      });
      setDeploymentRuns(data);
    } catch (error) {
      console.error('Failed to load deployment runs:', error);
    }
  };

  const loadProjectWebhooks = async () => {
    try {
      const [webhookData, deliveryData] = await Promise.all([
        api.get<ProjectWebhook[]>('/project-webhooks', {
          params: { projectId },
        }),
        api.get<WebhookDelivery[]>('/project-webhooks/deliveries', {
          params: { projectId },
        }),
      ]);
      setWebhooks(webhookData);
      setWebhookDeliveries(deliveryData);
    } catch (error) {
      console.error('Failed to load project webhooks:', error);
    }
  };

  const handleCreateDeploymentPlan = async () => {
    if (!project) return;

    setCreatingDeploymentRun(true);
    try {
      const run = await api.post<DeploymentRun>(`/deployments/projects/${projectId}/runs`, {
        dryRun: true,
        queue: queueDeploymentRun,
        branch: getProjectBranch(project.config) || undefined,
        environmentId: project.environments?.find((environment) => environment.status === 'active')?.id,
      });
      setDeploymentRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
    } catch (error) {
      console.error('Failed to create deployment run:', error);
      alert(error instanceof Error ? error.message : '生成部署执行计划失败');
    } finally {
      setCreatingDeploymentRun(false);
    }
  };

  const handleRequestLiveDeployment = async () => {
    if (!project) return;

    setRequestingLiveDeployment(true);
    try {
      const run = await api.post<DeploymentRun>(`/deployments/projects/${projectId}/runs`, {
        dryRun: false,
        queue: queueDeploymentRun,
        branch: getProjectBranch(project.config) || undefined,
        environmentId: project.environments?.find((environment) => environment.status === 'active')?.id,
        approvalReason: '申请执行项目 live 部署',
      });
      setDeploymentRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
    } catch (error) {
      console.error('Failed to request live deployment:', error);
      alert(error instanceof Error ? error.message : '申请 live 部署失败');
    } finally {
      setRequestingLiveDeployment(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!project) return;

    setCreatingWebhook(true);
    try {
      const previewWebhook = webhookTriggerMode === 'pr_preview';
      const webhook = await api.post<ProjectWebhook>('/project-webhooks', {
        projectId,
        provider: 'github',
        name: previewWebhook ? `${project.name} PR Preview` : undefined,
        environmentId: webhookEnvironmentId || undefined,
        eventTypes: previewWebhook ? ['pull_request', 'merge_request'] : ['push'],
        branchPattern: previewWebhook ? '*' : getProjectBranch(project.config) || 'main',
        deploymentMode: previewWebhook ? 'preview' : webhookDeploymentMode,
        maxAttempts: webhookMaxAttempts,
      });
      setCreatedWebhookSecret(webhook.setupSecret || '');
      setWebhooks((current) => [webhook, ...current.filter((item) => item.id !== webhook.id)]);
      loadProjectWebhooks();
    } catch (error) {
      console.error('Failed to create webhook:', error);
      alert(error instanceof Error ? error.message : '创建 Webhook 失败');
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleRotateWebhookSecret = async (webhook: ProjectWebhook) => {
    if (!confirm(`确定要轮换 ${webhook.name} 的 Webhook secret 吗？旧 secret 会立即失效。`)) {
      return;
    }

    setRotatingWebhookId(webhook.id);
    setRotatedWebhookSecret(null);
    try {
      const rotated = await api.post<ProjectWebhook>(`/project-webhooks/${webhook.id}/rotate-secret`);
      if (!rotated.setupSecret) {
        throw new Error('轮换成功，但响应缺少新 secret');
      }

      setRotatedWebhookSecret({ webhookId: webhook.id, secret: rotated.setupSecret });
      setWebhooks((current) => current.map((item) => (item.id === rotated.id ? rotated : item)));
      loadProjectWebhooks();
    } catch (error) {
      console.error('Failed to rotate webhook secret:', error);
      alert(error instanceof Error ? error.message : '轮换 Webhook secret 失败');
    } finally {
      setRotatingWebhookId('');
    }
  };

  const handleRollbackDeploymentRun = async (run: DeploymentRun) => {
    setRollingBackRunId(run.id);
    try {
      const rollbackRun = await api.post<DeploymentRun>(`/deployments/runs/${run.id}/rollback`, {
        dryRun: true,
        queue: queueDeploymentRun,
      });
      setDeploymentRuns((current) => [rollbackRun, ...current.filter((item) => item.id !== rollbackRun.id)]);
    } catch (error) {
      console.error('Failed to create deployment rollback:', error);
      alert(error instanceof Error ? error.message : '生成部署回滚计划失败');
    } finally {
      setRollingBackRunId('');
    }
  };

  const handleRequestLiveRollbackRun = async (run: DeploymentRun) => {
    setRequestingLiveRollbackRunId(run.id);
    try {
      const rollbackRun = await api.post<DeploymentRun>(`/deployments/runs/${run.id}/rollback`, {
        dryRun: false,
        queue: queueDeploymentRun,
        approvalReason: '申请执行项目 live 回滚',
        postRollbackSmokeCheck: postRollbackSmokeOnSuccess,
        postRollbackSmokeDryRun: true,
        postRollbackSmokeQueue: true,
      });
      setDeploymentRuns((current) => [rollbackRun, ...current.filter((item) => item.id !== rollbackRun.id)]);
      if (postRollbackSmokeOnSuccess) {
        void loadDeploymentRuns();
      }
    } catch (error) {
      console.error('Failed to request live deployment rollback:', error);
      alert(error instanceof Error ? error.message : '申请 live 回滚失败');
    } finally {
      setRequestingLiveRollbackRunId('');
    }
  };

  const handleRequestFailureRollbackRun = async (run: DeploymentRun) => {
    setRequestingFailureRollbackRunId(run.id);
    try {
      const rollbackRun = await api.post<DeploymentRun>(`/deployments/runs/${run.id}/failure-rollback`, {
        queue: queueDeploymentRun,
        approvalReason: '部署失败后申请回滚到最近成功版本',
        postRollbackSmokeCheck: postRollbackSmokeOnSuccess,
        postRollbackSmokeDryRun: true,
        postRollbackSmokeQueue: true,
      });
      setDeploymentRuns((current) => [rollbackRun, ...current.filter((item) => item.id !== rollbackRun.id)]);
      if (postRollbackSmokeOnSuccess) {
        void loadDeploymentRuns();
      }
    } catch (error) {
      console.error('Failed to request failed deployment rollback:', error);
      alert(error instanceof Error ? error.message : '申请失败回滚失败');
    } finally {
      setRequestingFailureRollbackRunId('');
    }
  };

  const handleSmokeFailureRollbackRun = async (run: DeploymentRun, dryRun = true) => {
    setRequestingSmokeFailureRollbackRunId(run.id);
    try {
      const rollbackRun = await api.post<DeploymentRun>(`/deployments/runs/${run.id}/smoke-failure-rollback`, {
        dryRun,
        queue: queueDeploymentRun,
        approvalReason: dryRun ? undefined : '部署 Smoke 失败后申请回滚到上一成功版本',
        postRollbackSmokeCheck: !dryRun && postRollbackSmokeOnSuccess,
        postRollbackSmokeDryRun: true,
        postRollbackSmokeQueue: true,
      });
      setDeploymentRuns((current) => [rollbackRun, ...current.filter((item) => item.id !== rollbackRun.id)]);
      if (!dryRun && postRollbackSmokeOnSuccess) {
        void loadDeploymentRuns();
      }
    } catch (error) {
      console.error('Failed to request smoke failure rollback:', error);
      alert(error instanceof Error ? error.message : (dryRun ? '生成 Smoke 失败回滚计划失败' : '申请 Smoke 失败回滚失败'));
    } finally {
      setRequestingSmokeFailureRollbackRunId('');
    }
  };

  const handleRetryDeploymentRun = async (run: DeploymentRun, dryRun = true) => {
    const setLoadingState = dryRun ? setRetryingDeploymentRunId : setRequestingLiveRetryRunId;
    setLoadingState(run.id);
    try {
      const retryRun = await api.post<DeploymentRun>(`/deployments/runs/${run.id}/retry`, {
        dryRun,
        queue: queueDeploymentRun,
        approvalReason: dryRun ? undefined : '申请重试失败 live 部署',
      });
      setDeploymentRuns((current) => [retryRun, ...current.filter((item) => item.id !== retryRun.id)]);
    } catch (error) {
      console.error('Failed to retry deployment run:', error);
      alert(error instanceof Error ? error.message : (dryRun ? '生成部署重试计划失败' : '申请 live 重试失败'));
    } finally {
      setLoadingState('');
    }
  };

  const handleSmokeCheckDeploymentRun = async (run: DeploymentRun, dryRun = true) => {
    const setLoadingState = dryRun ? setSmokeCheckingRunId : setExecutingLiveSmokeRunId;
    setLoadingState(run.id);
    try {
      const smokeRun = await api.post<DeploymentRun>(`/deployments/runs/${run.id}/smoke-check`, {
        dryRun,
        queue: queueDeploymentRun,
        autoRollbackOnFailure: !dryRun && smokeAutoRollbackOnFailure,
        autoRollbackDryRun: true,
        autoRollbackQueue: true,
      });
      setDeploymentRuns((current) => [smokeRun, ...current.filter((item) => item.id !== smokeRun.id)]);
      if (!dryRun && smokeAutoRollbackOnFailure) {
        void loadDeploymentRuns();
      }
    } catch (error) {
      console.error('Failed to create deployment smoke check:', error);
      alert(error instanceof Error ? error.message : (dryRun ? '生成部署 Smoke 检查失败' : '执行部署 Smoke 检查失败'));
    } finally {
      setLoadingState('');
    }
  };

  const handleSyncEnvironments = async () => {
    setSyncingEnvironments(true);
    try {
      await api.post('/project-environments/sync-from-project', { projectId });
      loadProject();
      loadEnvironmentSyncSuggestions();
    } catch (error) {
      console.error('Failed to sync project environments:', error);
      alert(error instanceof Error ? error.message : '同步项目环境失败');
    } finally {
      setSyncingEnvironments(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个项目吗？此操作不可恢复。')) return;
    try {
      await api.delete(`/projects/${projectId}`);
      router.push('/projects');
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>;
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">项目不存在</p>
        <button onClick={() => router.push('/projects')} className="mt-4 text-primary hover:underline">
          返回列表
        </button>
      </div>
    );
  }

  const description = getProjectDescription(project.config, project.description);
  const originLabel = getProjectOriginLabel(project.config);
  const repository = getProjectRepository(project.config, project.gitRepo);
  const branch = getProjectBranch(project.config);
  const managementScope = getProjectManagementScope(project.config);
  const managementScopeLabel = getProjectManagementScopeLabel(project.config);
  const configEnvironments = getProjectEnvironmentLabels(project.config);
  const projectEnvironments = (project.environments || []).filter((environment) => environment.status !== 'archived');
  const environmentLabels = projectEnvironments.length > 0
    ? projectEnvironments.map((environment) => environment.name)
    : configEnvironments;
  const subProjects = getProjectSubProjectLabels(project.config);
  const stackTags = getProjectStackTags(project.config);
  const deploymentConfig = getProjectDeploymentConfig(project.config);
  const hasDeploymentConfig =
    managementScope === 'deployment' ||
    Boolean(
      deploymentConfig.targetType ||
        deploymentConfig.workingDirectory ||
        deploymentConfig.buildCommand ||
        deploymentConfig.deployCommand ||
        deploymentConfig.healthCheckUrl,
    );
  const generated = isGeneratedProject(project.config);
  const selectedEnvironment =
    projectEnvironments.find((environment) => environment.id === selectedEnvironmentId) ||
    projectEnvironments[0] ||
    null;
  const environmentServices = (project.applications || []).flatMap((application) =>
    application.services
      .filter((service) => matchesProjectEnvironment(service.environment, selectedEnvironment))
      .map((service) => ({ ...service, applicationName: application.name })),
  );
  const environmentSites = (project.sites || []).filter((site) =>
    matchesProjectEnvironment(site.environment, selectedEnvironment),
  );
  const environmentDeployments = deploymentRuns.filter((run) =>
    matchesProjectEnvironment(run.projectEnvironment, selectedEnvironment, run.environment),
  );
  const environmentManagedResources = (project.managedResources || []).filter((resource) =>
    matchesProjectEnvironment(resource.environment, selectedEnvironment),
  );
  const environmentResourceInstances = (project.resourceInstances || []).filter((instance) =>
    matchesProjectEnvironment(instance.projectEnvironment, selectedEnvironment),
  );
  const environmentCdnConfigs = (project.cdnConfigs || []).filter((config) =>
    matchesProjectEnvironment(config.environment, selectedEnvironment),
  );
  const environmentSecretKeys = (project.secretKeys || []).filter((secret) =>
    matchesProjectEnvironment(secret.environment, selectedEnvironment),
  );
  const environmentServerBindings = selectedEnvironment?.serverBindings || [];
  const environmentServerIds = new Set(environmentServerBindings.map((binding) => binding.server.id));
  const bindableServers = servers.filter((server) => !environmentServerIds.has(server.id));
  const selectedServerForBinding = servers.find((server) => server.id === serverBindingServerId) || null;
  const environmentResourceCount = environmentManagedResources.length + environmentResourceInstances.length;
  const environmentSummaries = projectEnvironments.map((environment) => {
    const services = (project.applications || []).flatMap((application) =>
      application.services.filter((service) => matchesProjectEnvironment(service.environment, environment)),
    );
    const sites = (project.sites || []).filter((site) => matchesProjectEnvironment(site.environment, environment));
    const deployments = deploymentRuns.filter((run) =>
      matchesProjectEnvironment(run.projectEnvironment, environment, run.environment),
    );
    const managedResources = (project.managedResources || []).filter((resource) =>
      matchesProjectEnvironment(resource.environment, environment),
    );
    const resourceInstances = (project.resourceInstances || []).filter((instance) =>
      matchesProjectEnvironment(instance.projectEnvironment, environment),
    );
    const cdnConfigs = (project.cdnConfigs || []).filter((config) =>
      matchesProjectEnvironment(config.environment, environment),
    );
    const secretKeys = (project.secretKeys || []).filter((secret) =>
      matchesProjectEnvironment(secret.environment, environment),
    );
    const serverBindings = environment.serverBindings || [];
    const resourceCount = managedResources.length + resourceInstances.length;

    return {
      environment,
      serverCount: serverBindings.length,
      serviceCount: services.length,
      resourceCount,
      siteCount: sites.length,
      cdnCount: cdnConfigs.length,
      deploymentCount: deployments.length,
      secretCount: secretKeys.length,
      gaps: buildEnvironmentGaps({
        serverCount: serverBindings.length,
        serviceCount: services.length,
        resourceCount,
        siteCount: sites.length,
        deploymentCount: deployments.length,
      }),
    };
  });
  const selectedEnvironmentSummary = environmentSummaries.find(
    (summary) => summary.environment.id === selectedEnvironment?.id,
  );
  const environmentConfigProfiles = buildEnvironmentConfigProfiles(project, deploymentRuns, projectEnvironments);
  const configReferenceProfile = environmentConfigProfiles.find((profile) => profile.isReference) || null;
  const environmentSuggestionByEnvironmentId = new Map(
    (environmentSyncSuggestions?.profiles || []).map((profile) => [profile.environment.id, profile]),
  );
  const serviceBindingGaps = environmentServices.filter(
    (service) => !service.server && !service.site && !service.managedResource,
  );
  const unboundManagedResources = (project.managedResources || []).filter((resource) => !resource.environment?.id);
  const unboundResourceInstances = (project.resourceInstances || []).filter((instance) => !instance.projectEnvironment?.id);
  const unboundSites = (project.sites || []).filter((site) => !site.environment?.id);
  const unboundCdnConfigs = (project.cdnConfigs || []).filter((config) => !config.environment?.id);
  const unboundSecretKeys = (project.secretKeys || []).filter((secret) => !secret.environment?.id);
  const unboundEnvironmentCount =
    unboundManagedResources.length +
    unboundResourceInstances.length +
    unboundSites.length +
    unboundCdnConfigs.length +
    unboundSecretKeys.length;
  const selectedResourceBulkBindCount = countResourceBulkBindSelection(resourceBulkBindSelection);
  const resourceBulkBindGroups: Array<{
    key: EnvironmentResourceBulkBindSelectionKey;
    label: string;
    items: Array<{ id: string; title: string; detail: string }>;
  }> = [
    {
      key: 'managedResourceIds' as EnvironmentResourceBulkBindSelectionKey,
      label: '托管资源',
      items: unboundManagedResources.map((resource) => ({
        id: resource.id,
        title: resource.name,
        detail: `${resourceProviderLabels[resource.provider] || resource.provider}/${resourceKindLabels[resource.kind] || resource.kind}${resource.endpoint ? ` · ${resource.endpoint}` : ''}`,
      })),
    },
    {
      key: 'resourceInstanceIds' as EnvironmentResourceBulkBindSelectionKey,
      label: '资源实例',
      items: unboundResourceInstances.map((instance) => ({
        id: instance.id,
        title: instance.name,
        detail: instance.resourceType?.name || instance.resourceType?.key || instance.status,
      })),
    },
    {
      key: 'siteIds' as EnvironmentResourceBulkBindSelectionKey,
      label: '站点',
      items: unboundSites.map((site) => ({
        id: site.id,
        title: site.name,
        detail: `${site.primaryDomain} · ${site.runtimeType}`,
      })),
    },
    {
      key: 'cdnConfigIds' as EnvironmentResourceBulkBindSelectionKey,
      label: 'CDN',
      items: unboundCdnConfigs.map((config) => ({
        id: config.id,
        title: config.name,
        detail: `${config.provider} · ${config.domain}`,
      })),
    },
    {
      key: 'secretKeyIds' as EnvironmentResourceBulkBindSelectionKey,
      label: '密钥',
      items: unboundSecretKeys.map((secret) => ({
        id: secret.id,
        title: secret.name,
        detail: secret.type,
      })),
    },
  ].filter((group) => group.items.length > 0);
  const selectedEnvironmentResourceBindResult = selectedEnvironment
    ? environmentResourceBindResults[selectedEnvironment.id]
    : null;
  const selectableSiteCopySourceEnvironments = projectEnvironments.filter(
    (environment) => environment.id !== selectedEnvironment?.id,
  );
  const referenceSiteCopyEnvironment =
    configReferenceProfile && configReferenceProfile.environment.id !== selectedEnvironment?.id
      ? configReferenceProfile.environment
      : null;
  const siteCopySourceEnvironment =
    selectableSiteCopySourceEnvironments.find((environment) => environment.id === siteCopySourceEnvironmentId) ||
    referenceSiteCopyEnvironment ||
    selectableSiteCopySourceEnvironments[0] ||
    null;
  const sourceSiteCopySites = (project.sites || []).filter((site) =>
    matchesProjectEnvironment(site.environment, siteCopySourceEnvironment),
  );
  const targetSiteCopyDomains = new Set(
    environmentSites.map((site) => normalizeDomain(site.primaryDomain)).filter(Boolean),
  );
  const selectedSiteCopyCount = sourceSiteCopySites.filter((site) => siteCopyDomainOverrides[site.id]?.trim()).length;
  const duplicateSiteCopyDomainCount = sourceSiteCopySites.filter((site) => {
    const normalizedDomain = normalizeDomain(siteCopyDomainOverrides[site.id] || '');
    return normalizedDomain && targetSiteCopyDomains.has(normalizedDomain);
  }).length;
  const selectedSiteCopyResult =
    selectedEnvironment && siteCopySourceEnvironment
      ? siteCopyResults[buildSiteCopyResultKey(siteCopySourceEnvironment.id, selectedEnvironment.id)]
      : null;
  const selectedSiteCopyResultKey =
    selectedEnvironment && siteCopySourceEnvironment
      ? buildSiteCopyResultKey(siteCopySourceEnvironment.id, selectedEnvironment.id)
      : '';
  const selectableCdnCopySourceEnvironments = projectEnvironments.filter(
    (environment) => environment.id !== selectedEnvironment?.id,
  );
  const referenceCdnCopyEnvironment =
    configReferenceProfile && configReferenceProfile.environment.id !== selectedEnvironment?.id
      ? configReferenceProfile.environment
      : null;
  const cdnCopySourceEnvironment =
    selectableCdnCopySourceEnvironments.find((environment) => environment.id === cdnCopySourceEnvironmentId) ||
    referenceCdnCopyEnvironment ||
    selectableCdnCopySourceEnvironments[0] ||
    null;
  const sourceCdnCopyConfigs = (project.cdnConfigs || []).filter((config) =>
    matchesProjectEnvironment(config.environment, cdnCopySourceEnvironment),
  );
  const targetCdnCopyDomains = new Set(
    environmentCdnConfigs.map((config) => normalizeDomain(config.domain)).filter(Boolean),
  );
  const selectedCdnCopyCount = sourceCdnCopyConfigs.filter((config) =>
    cdnCopyDomainOverrides[config.id]?.trim() &&
    cdnCopyOriginOverrides[config.id]?.trim() &&
    cdnCopyCredentialIds[config.id]?.trim(),
  ).length;
  const duplicateCdnCopyDomainCount = sourceCdnCopyConfigs.filter((config) => {
    const normalizedDomain = normalizeDomain(cdnCopyDomainOverrides[config.id] || '');
    return normalizedDomain && targetCdnCopyDomains.has(normalizedDomain);
  }).length;
  const selectedCdnCopyResult =
    selectedEnvironment && cdnCopySourceEnvironment
      ? cdnCopyResults[buildCopyResultKey(cdnCopySourceEnvironment.id, selectedEnvironment.id)]
      : null;
  const selectedCdnCopyResultKey =
    selectedEnvironment && cdnCopySourceEnvironment
      ? buildCopyResultKey(cdnCopySourceEnvironment.id, selectedEnvironment.id)
      : '';
  const selectableResourceCopySourceEnvironments = projectEnvironments.filter(
    (environment) => environment.id !== selectedEnvironment?.id,
  );
  const referenceResourceCopyEnvironment =
    configReferenceProfile && configReferenceProfile.environment.id !== selectedEnvironment?.id
      ? configReferenceProfile.environment
      : null;
  const resourceCopySourceEnvironment =
    selectableResourceCopySourceEnvironments.find((environment) => environment.id === resourceCopySourceEnvironmentId) ||
    referenceResourceCopyEnvironment ||
    selectableResourceCopySourceEnvironments[0] ||
    null;
  const sourceResourceCopyManagedResources = (project.managedResources || []).filter((resource) =>
    matchesProjectEnvironment(resource.environment, resourceCopySourceEnvironment),
  );
  const sourceResourceCopySecretKeys = (project.secretKeys || []).filter((secret) =>
    matchesProjectEnvironment(secret.environment, resourceCopySourceEnvironment),
  );
  const targetResourceCopyKeys = new Set(
    environmentManagedResources.map((resource) =>
      buildManagedResourceCopyKey(resource.sourceType, resource.provider, resource.externalId),
    ),
  );
  const targetSecretCopyNames = new Set(environmentSecretKeys.map((secret) => secret.name));
  const selectedManagedResourceCopyCount = sourceResourceCopyManagedResources.filter((resource) =>
    resourceCopyExternalIds[resource.id]?.trim(),
  ).length;
  const selectedSecretCopyCount = sourceResourceCopySecretKeys.filter((secret) =>
    typeof secretCopyValues[secret.id] === 'string' && secretCopyValues[secret.id].length > 0,
  ).length;
  const selectedResourceCopyCount = selectedManagedResourceCopyCount + selectedSecretCopyCount;
  const duplicateResourceCopyCount = sourceResourceCopyManagedResources.filter((resource) => {
    const targetExternalId = resourceCopyExternalIds[resource.id]?.trim();
    return targetExternalId && targetResourceCopyKeys.has(
      buildManagedResourceCopyKey(resource.sourceType, resource.provider, targetExternalId),
    );
  }).length;
  const duplicateSecretCopyNameCount = sourceResourceCopySecretKeys.filter((secret) => {
    const targetName = secretCopyNames[secret.id]?.trim() || `${secret.name} (${selectedEnvironment?.name || ''})`;
    return targetName && targetSecretCopyNames.has(targetName);
  }).length;
  const selectedResourceCopyResult =
    selectedEnvironment && resourceCopySourceEnvironment
      ? resourceCopyResults[buildCopyResultKey(resourceCopySourceEnvironment.id, selectedEnvironment.id)]
      : null;
  const selectedResourceCopyResultKey =
    selectedEnvironment && resourceCopySourceEnvironment
      ? buildCopyResultKey(resourceCopySourceEnvironment.id, selectedEnvironment.id)
      : '';
  const resourceControlHref = buildScopedHref('/resource-control', project.id, selectedEnvironment?.id);
  const applicationsHref = buildScopedHref('/applications', project.id, selectedEnvironment?.id);
  const siteCreateHref = buildScopedHref('/sites', project.id, selectedEnvironment?.id, { new: 'true' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => router.push('/projects')} className="text-muted-foreground hover:text-foreground">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
          {originLabel}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {managementScopeLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 基本信息 */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">基本信息</h2>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="text-sm text-primary hover:underline">
                  编辑
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="text-sm text-muted-foreground hover:underline">
                    取消
                  </button>
                  <button onClick={handleSave} className="text-sm text-primary hover:underline">
                    保存
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">项目名称</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">描述</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2">
                  <dt className="text-muted-foreground">描述</dt>
                  <dd>{description || '无描述'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">项目来源</dt>
                  <dd>{originLabel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">管理范围</dt>
                  <dd>{managementScopeLabel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">初始化</dt>
                  <dd>{generated ? '已通过初始化器生成' : '未绑定初始化器'}</dd>
                </div>
                {repository && (
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Git 仓库</dt>
                    <dd>
                      <a href={repository} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono text-xs">
                        {repository}
                      </a>
                    </dd>
                  </div>
                )}
                {branch && (
                  <div>
                    <dt className="text-muted-foreground">默认分支</dt>
                    <dd className="font-mono text-xs">{branch}</dd>
                  </div>
                )}
                {environmentLabels.length > 0 && (
                  <div>
                    <dt className="text-muted-foreground">环境</dt>
                    <dd className="flex flex-wrap gap-1 mt-1">
                      {environmentLabels.map((environment) => (
                        <span key={environment} className="px-2 py-0.5 text-xs rounded-full bg-muted">
                          {environment}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {subProjects.length > 0 && (
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">子项目</dt>
                    <dd className="flex gap-1 mt-1">
                      {subProjects.map((subProject) => (
                        <span key={subProject} className="px-2 py-0.5 text-xs rounded-full bg-muted">
                          {subProject}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {stackTags.length > 0 && (
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">技术栈</dt>
                    <dd className="flex flex-wrap gap-1 mt-1">
                      {stackTags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-muted">
                          {tag}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">创建时间</dt>
                  <dd>{new Date(project.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">更新时间</dt>
                  <dd>{new Date(project.updatedAt).toLocaleString()}</dd>
                </div>
              </dl>
            )}
          </div>

          <div className="border rounded-lg p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">项目环境</h2>
                <p className="mt-1 text-sm text-muted-foreground">按环境区分部署、站点和资源归属</p>
              </div>
              <button
                onClick={handleSyncEnvironments}
                disabled={syncingEnvironments}
                className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {syncingEnvironments ? '同步中...' : '从配置同步'}
              </button>
            </div>
            {projectEnvironments.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {projectEnvironments.map((environment) => (
                  <div key={environment.id} className="rounded-md bg-muted/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{environment.name}</div>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {environment.status === 'active' ? '启用' : environment.status}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">{environment.key}</div>
                    {environment.serverBindings && environment.serverBindings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {environment.serverBindings.map((binding) => (
                          <span key={binding.id} className="rounded bg-background px-2 py-0.5 text-xs text-muted-foreground">
                            {binding.server.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {environment._count && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>服务器 {environment._count.serverBindings}</div>
                        <div>站点 {environment._count.sites}</div>
                        <div>部署 {environment._count.deploymentRuns}</div>
                        <div>资源 {environment._count.managedResources + environment._count.resourceInstances}</div>
                        <div>CDN {environment._count.cdnConfigs}</div>
                        <div>密钥 {environment._count.secretKeys}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : configEnvironments.length > 0 ? (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                当前项目还没有环境记录，可从历史配置同步：{configEnvironments.join('、')}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无项目环境</p>
            )}
          </div>

          {projectEnvironments.length > 0 && selectedEnvironment && (
            <div className="border rounded-lg p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">环境工作台</h2>
                  <p className="mt-1 text-sm text-muted-foreground">按环境查看资源、服务和运行状态</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={resourceControlHref}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                  >
                    资源管控
                  </Link>
                  <Link
                    href={applicationsHref}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                  >
                    应用服务
                  </Link>
                  <Link
                    href={siteCreateHref}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                  >
                    添加站点
                  </Link>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {projectEnvironments.map((environment) => (
                  <button
                    key={environment.id}
                    type="button"
                    onClick={() => setSelectedEnvironmentId(environment.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                      selectedEnvironment.id === environment.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                  >
                    {environment.name}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-md bg-muted/50 p-3">
                  <div className="text-muted-foreground">服务器</div>
                  <div className="mt-1 text-lg font-semibold">{environmentServerBindings.length}</div>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <div className="text-muted-foreground">应用服务</div>
                  <div className="mt-1 text-lg font-semibold">{environmentServices.length}</div>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <div className="text-muted-foreground">资源</div>
                  <div className="mt-1 text-lg font-semibold">{environmentResourceCount}</div>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <div className="text-muted-foreground">站点</div>
                  <div className="mt-1 text-lg font-semibold">{environmentSites.length}</div>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <div className="text-muted-foreground">部署</div>
                  <div className="mt-1 text-lg font-semibold">{environmentDeployments.length}</div>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <div className="text-muted-foreground">密钥</div>
                  <div className="mt-1 text-lg font-semibold">{environmentSecretKeys.length}</div>
                </div>
              </div>

              <div className="mt-4 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">环境服务器</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      服务器绑定决定 Docker、部署、站点同步、日志采集等后续操作的执行边界
                    </div>
                  </div>
                  <Link href="/servers" className="text-xs font-medium text-primary hover:underline">
                    管理服务器
                  </Link>
                </div>

                {environmentServerBindings.length > 0 ? (
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {environmentServerBindings.map((binding) => (
                      <div key={binding.id} className="rounded-md bg-muted/50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium" title={binding.server.name}>
                              {binding.server.name}
                            </div>
                            <div className="mt-1 truncate font-mono text-xs text-muted-foreground" title={binding.server.host}>
                              {binding.server.host}
                            </div>
                          </div>
                          <span className="rounded bg-background px-2 py-0.5 text-xs text-muted-foreground">
                            {getServerRoleLabel(binding.role)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span className={getServerStatusClassName(binding.server.status)}>
                            {getServerStatusLabel(binding.server.status)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnbindServerFromEnvironment(binding)}
                            disabled={unbindingServerId === binding.server.id}
                            className="font-medium text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {unbindingServerId === binding.server.id ? '解绑中...' : '解绑'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-md bg-yellow-50 p-2 text-xs text-yellow-800">
                    当前环境还没有服务器，部署、Docker 发现、站点同步和服务器日志采集都缺少执行目标。
                  </div>
                )}

                <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_160px_auto]">
                  <select
                    value={serverBindingServerId}
                    onChange={(event) => setServerBindingServerId(event.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">选择要绑定的服务器</option>
                    {bindableServers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name} · {server.username}@{server.host}:{server.port}
                      </option>
                    ))}
                  </select>
                  <select
                    value={serverBindingRole}
                    onChange={(event) => setServerBindingRole(event.target.value as typeof serverBindingRole)}
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {serverRoleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleBindServerToEnvironment}
                    disabled={!serverBindingServerId || bindingServerId === serverBindingServerId}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bindingServerId === serverBindingServerId ? '绑定中...' : '绑定服务器'}
                  </button>
                </div>
                {selectedServerForBinding && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    将绑定：{selectedServerForBinding.name}，当前状态 {getServerStatusLabel(selectedServerForBinding.status)}
                  </div>
                )}
                {bindableServers.length === 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    没有可绑定的服务器；可以先在服务器管理中添加，或切换到其他环境查看。
                  </div>
                )}
              </div>

              {selectedEnvironmentSummary && (selectedEnvironmentSummary.gaps.length > 0 || serviceBindingGaps.length > 0) && (
                <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                  <div className="font-medium">当前环境待补齐</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedEnvironmentSummary.gaps.map((gap) => (
                      <Link
                        key={gap}
                        href={getEnvironmentGapHref(gap, {
                          resourceControlHref,
                          applicationsHref,
                          siteCreateHref,
                        })}
                        className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium hover:underline"
                      >
                        {gap}
                      </Link>
                    ))}
                    {serviceBindingGaps.slice(0, 3).map((service) => (
                      <Link
                        key={service.id}
                        href={applicationsHref}
                        className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium hover:underline"
                      >
                        服务 {service.name} 未绑定运行资源
                      </Link>
                    ))}
                    {serviceBindingGaps.length > 3 && (
                      <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium">
                        还有 {serviceBindingGaps.length - 3} 个服务待绑定
                      </span>
                    )}
                  </div>
                </div>
              )}

              {unboundEnvironmentCount > 0 && (
                <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">仍有项目资源未绑定环境</div>
                      <div className="mt-1 text-xs">
                        未绑定环境的资源不会出现在 dev/test/staging/prod 工作台里，需要先补齐环境归属。
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedEnvironment && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEnvironmentResourceBulkBind(selectedEnvironment, true)}
                            disabled={selectedResourceBulkBindCount === 0 || runningResourceBindId === `${selectedEnvironment.id}:plan`}
                            className="rounded border border-orange-300 px-2 py-1 text-xs font-medium text-orange-900 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {runningResourceBindId === `${selectedEnvironment.id}:plan` ? '生成中...' : '预览绑定到当前环境'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEnvironmentResourceBulkBind(selectedEnvironment, false)}
                            disabled={selectedResourceBulkBindCount === 0 || runningResourceBindId === `${selectedEnvironment.id}:apply`}
                            className="rounded bg-orange-600 px-2 py-1 text-xs font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {runningResourceBindId === `${selectedEnvironment.id}:apply` ? '绑定中...' : '绑定到当前环境'}
                          </button>
                        </>
                      )}
                      <Link href={`/resource-control?projectId=${project.id}`} className="self-center text-xs font-medium text-orange-900 hover:underline">
                        去资源管控
                      </Link>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {unboundManagedResources.length > 0 && (
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium">
                        托管资源 {unboundManagedResources.length}
                      </span>
                    )}
                    {unboundResourceInstances.length > 0 && (
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium">
                        资源实例 {unboundResourceInstances.length}
                      </span>
                    )}
                    {unboundSites.length > 0 && (
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium">
                        站点 {unboundSites.length}
                      </span>
                    )}
                    {unboundCdnConfigs.length > 0 && (
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium">
                        CDN {unboundCdnConfigs.length}
                      </span>
                    )}
                    {unboundSecretKeys.length > 0 && (
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium">
                        密钥 {unboundSecretKeys.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium">
                      已选择 {selectedResourceBulkBindCount} / {unboundEnvironmentCount} 个资源
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllUnboundResources}
                        className="rounded border border-orange-300 px-2 py-0.5 font-medium hover:bg-orange-100"
                      >
                        全选
                      </button>
                      <button
                        type="button"
                        onClick={handleClearResourceBulkBindSelection}
                        className="rounded border border-orange-300 px-2 py-0.5 font-medium hover:bg-orange-100"
                      >
                        清空
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {resourceBulkBindGroups.map((group) => {
                      const selectedInGroup = resourceBulkBindSelection[group.key];

                      return (
                        <div key={group.key} className="rounded-md border border-orange-200 bg-white/70 p-2">
                          <div className="flex items-center justify-between gap-2 text-xs font-medium">
                            <span>{group.label}</span>
                            <span className="text-orange-700">{selectedInGroup.length}/{group.items.length}</span>
                          </div>
                          <div className="mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
                            {group.items.map((item) => (
                              <label
                                key={item.id}
                                className="flex items-start gap-2 rounded px-2 py-1 hover:bg-orange-100"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedInGroup.includes(item.id)}
                                  onChange={(event) =>
                                    handleToggleResourceBulkBindSelection(group.key, item.id, event.target.checked)
                                  }
                                  className="mt-0.5 h-4 w-4 rounded border-orange-300"
                                />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-orange-950" title={item.title}>
                                    {item.title}
                                  </span>
                                  <span className="block truncate text-orange-700" title={item.detail}>
                                    {item.detail}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedEnvironmentResourceBindResult && (
                    <div className="mt-3 rounded-md bg-orange-100 p-2 text-xs">
                      <div className="font-medium">
                        {selectedEnvironmentResourceBindResult.dryRun ? '最近绑定计划' : '最近绑定结果'}：
                        {selectedEnvironmentResourceBindResult.appliedCount > 0
                          ? `已绑定 ${selectedEnvironmentResourceBindResult.appliedCount}`
                          : `计划 ${selectedEnvironmentResourceBindResult.plannedCount}`}
                      </div>
                      <div className="mt-2 space-y-1">
                        {selectedEnvironmentResourceBindResult.steps.slice(0, 6).map((step) => (
                          <div key={`${step.type}-${step.resourceId}`} className={getResourceBulkBindStepClassName(step.status)}>
                            {step.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {projectEnvironments.length > 1 && (
                <div className="mt-4 rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">跨环境复制资源/密钥</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        从源环境创建 ManagedResource 和 SecretKey 安全骨架到当前环境
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs font-medium">
                      <Link href={resourceControlHref} className="text-primary hover:underline">
                        管理资源
                      </Link>
                      <Link href={`/keys?projectId=${project.id}`} className="text-primary hover:underline">
                        管理密钥
                      </Link>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <label className="text-xs">
                      <span className="mb-1 block font-medium">源环境</span>
                      <select
                        value={resourceCopySourceEnvironment?.id || ''}
                        onChange={(event) => setResourceCopySourceEnvironmentId(event.target.value)}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        {selectableResourceCopySourceEnvironments.map((environment) => (
                          <option key={environment.id} value={environment.id}>
                            {environment.name} / {environment.key}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">
                        目标环境：{selectedEnvironment.name} / {selectedEnvironment.key}
                      </div>
                      <div className="mt-1">
                        源环境资源 {sourceResourceCopyManagedResources.length} 个、密钥 {sourceResourceCopySecretKeys.length} 个，
                        已填写资源 {selectedManagedResourceCopyCount} 个、密钥 {selectedSecretCopyCount} 个
                        {duplicateResourceCopyCount + duplicateSecretCopyNameCount > 0
                          ? `，${duplicateResourceCopyCount + duplicateSecretCopyNameCount} 个目标可能已存在`
                          : ''}
                      </div>
                    </div>
                  </div>

                  {resourceCopySourceEnvironment && (sourceResourceCopyManagedResources.length > 0 || sourceResourceCopySecretKeys.length > 0) ? (
                    <>
                      {sourceResourceCopyManagedResources.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">ManagedResource</div>
                          {sourceResourceCopyManagedResources.map((resource) => {
                            const targetExternalId = resourceCopyExternalIds[resource.id] || '';
                            const duplicateTargetResource = Boolean(
                              targetExternalId.trim() &&
                              targetResourceCopyKeys.has(
                                buildManagedResourceCopyKey(resource.sourceType, resource.provider, targetExternalId.trim()),
                              ),
                            );
                            const targetServerId = resourceCopyServerIds[resource.id] || '';
                            const targetCredentialId = resourceCopyCredentialIds[resource.id] || '';

                            return (
                              <div
                                key={resource.id}
                                className={`rounded-md border p-2 ${
                                  duplicateTargetResource ? 'border-yellow-300 bg-yellow-50' : 'bg-background'
                                }`}
                              >
                                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(200px,280px)_minmax(200px,280px)]">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="truncate font-medium" title={resource.name}>
                                        {resource.name}
                                      </span>
                                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                                        {resourceProviderLabels[resource.provider] || resource.provider}
                                      </span>
                                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                                        {resourceKindLabels[resource.kind] || resource.kind}
                                      </span>
                                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getResourceStatusClass(resource.status)}`}>
                                        {getResourceStatusLabel(resource.status)}
                                      </span>
                                    </div>
                                    <div className="mt-1 truncate font-mono text-xs text-muted-foreground" title={resource.externalId}>
                                      {resource.externalId}
                                    </div>
                                    <div className="mt-1 truncate text-xs text-muted-foreground" title={resource.endpoint || undefined}>
                                      {resource.endpoint || '暂无 endpoint'}
                                    </div>
                                  </div>
                                  <label className="text-xs">
                                    <span className="mb-1 block font-medium">目标 externalId</span>
                                    <input
                                      type="text"
                                      value={targetExternalId}
                                      onChange={(event) => handleResourceCopyFieldChange('externalId', resource.id, event.target.value)}
                                      placeholder="目标资源唯一 ID"
                                      className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                                        duplicateTargetResource ? 'border-yellow-400' : ''
                                      }`}
                                    />
                                    {duplicateTargetResource && (
                                      <span className="mt-1 block text-yellow-700">目标环境已有同 provider/sourceType/externalId</span>
                                    )}
                                  </label>
                                  <label className="text-xs">
                                    <span className="mb-1 block font-medium">目标名称</span>
                                    <input
                                      type="text"
                                      value={resourceCopyNames[resource.id] || ''}
                                      onChange={(event) => handleResourceCopyFieldChange('name', resource.id, event.target.value)}
                                      placeholder={`${resource.name} (${selectedEnvironment.name})`}
                                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                    />
                                  </label>
                                </div>

                                <div className="mt-2 grid gap-2 md:grid-cols-3">
                                  <label className="text-xs">
                                    <span className="mb-1 block font-medium">目标 endpoint</span>
                                    <input
                                      type="text"
                                      value={resourceCopyEndpoints[resource.id] || ''}
                                      onChange={(event) => handleResourceCopyFieldChange('endpoint', resource.id, event.target.value)}
                                      placeholder={resource.endpoint || 'host:port'}
                                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                    />
                                  </label>
                                  <label className="text-xs">
                                    <span className="mb-1 block font-medium">目标服务器</span>
                                    <select
                                      value={targetServerId}
                                      onChange={(event) => handleResourceCopyFieldChange('server', resource.id, event.target.value)}
                                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                    >
                                      <option value="">不绑定服务器</option>
                                      {servers.map((server) => (
                                        <option key={server.id} value={server.id}>
                                          {server.name} · {server.host}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="text-xs">
                                    <span className="mb-1 block font-medium">目标凭据</span>
                                    <select
                                      value={targetCredentialId}
                                      onChange={(event) => handleResourceCopyFieldChange('credential', resource.id, event.target.value)}
                                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                    >
                                      <option value="">不绑定凭据</option>
                                      {teamCredentials.map((credential) => (
                                        <option key={credential.id} value={credential.id}>
                                          {credential.name} · {credential.type}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {sourceResourceCopySecretKeys.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">SecretKey</div>
                          {sourceResourceCopySecretKeys.map((secret) => {
                            const targetName = secretCopyNames[secret.id] || '';
                            const effectiveTargetName = targetName.trim() || `${secret.name} (${selectedEnvironment.name})`;
                            const duplicateTargetSecret = Boolean(
                              effectiveTargetName && targetSecretCopyNames.has(effectiveTargetName),
                            );
                            const targetValue = secretCopyValues[secret.id] || '';

                            return (
                              <div
                                key={secret.id}
                                className={`rounded-md border p-2 ${
                                  duplicateTargetSecret ? 'border-yellow-300 bg-yellow-50' : 'bg-background'
                                }`}
                              >
                                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(220px,300px)_minmax(220px,300px)_minmax(220px,300px)]">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="truncate font-medium" title={secret.name}>
                                        {secret.name}
                                      </span>
                                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                                        {secret.type}
                                      </span>
                                    </div>
                                    <div className="mt-1 truncate text-xs text-muted-foreground" title={secret.description || undefined}>
                                      {secret.description || '暂无描述'}
                                    </div>
                                  </div>
                                  <label className="text-xs">
                                    <span className="mb-1 block font-medium">目标名称</span>
                                    <input
                                      type="text"
                                      value={targetName}
                                      onChange={(event) => handleResourceCopyFieldChange('secretName', secret.id, event.target.value)}
                                      placeholder={`${secret.name} (${selectedEnvironment.name})`}
                                      className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                                        duplicateTargetSecret ? 'border-yellow-400' : ''
                                      }`}
                                    />
                                    {duplicateTargetSecret && (
                                      <span className="mt-1 block text-yellow-700">目标环境已存在同名密钥</span>
                                    )}
                                  </label>
                                  <label className="text-xs">
                                    <span className="mb-1 block font-medium">新密钥值</span>
                                    <input
                                      type="password"
                                      value={targetValue}
                                      onChange={(event) => handleResourceCopyFieldChange('secretValue', secret.id, event.target.value)}
                                      placeholder="输入目标环境的新值"
                                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                    />
                                  </label>
                                  <label className="text-xs">
                                    <span className="mb-1 block font-medium">目标描述</span>
                                    <input
                                      type="text"
                                      value={secretCopyDescriptions[secret.id] || ''}
                                      onChange={(event) => handleResourceCopyFieldChange('secretDescription', secret.id, event.target.value)}
                                      placeholder={secret.description || '可选'}
                                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                    />
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          {duplicateResourceCopyCount + duplicateSecretCopyNameCount > 0
                            ? '重复目标会在计划或执行结果里标记为跳过'
                            : '执行后需要再做连接探测、云同步或运行态接管'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEnvironmentResourceCopy(true)}
                            disabled={selectedResourceCopyCount === 0 || runningResourceCopyId === `${selectedResourceCopyResultKey}:plan`}
                            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {runningResourceCopyId === `${selectedResourceCopyResultKey}:plan` ? '生成中...' : '预览复制'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEnvironmentResourceCopy(false)}
                            disabled={selectedResourceCopyCount === 0 || runningResourceCopyId === `${selectedResourceCopyResultKey}:apply`}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {runningResourceCopyId === `${selectedResourceCopyResultKey}:apply` ? '创建中...' : '创建资源/密钥骨架'}
                          </button>
                        </div>
                      </div>

                      {selectedResourceCopyResult && (
                        <div className="mt-3 rounded-md bg-muted/50 p-2 text-xs">
                          <div className="font-medium text-foreground">
                            {selectedResourceCopyResult.dryRun ? '最近复制计划' : '最近复制结果'}：
                            {selectedResourceCopyResult.appliedCount > 0
                              ? `已创建 ${selectedResourceCopyResult.appliedCount}`
                              : `计划 ${selectedResourceCopyResult.plannedCount}`}
                            {selectedResourceCopyResult.skippedCount > 0 ? `，跳过 ${selectedResourceCopyResult.skippedCount}` : ''}
                          </div>
                          {selectedResourceCopyResult.warnings.length > 0 && (
                            <div className="mt-2 space-y-1 text-muted-foreground">
                              {selectedResourceCopyResult.warnings.slice(0, 2).map((warning) => (
                                <div key={warning}>{warning}</div>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 space-y-1">
                            {selectedResourceCopyResult.steps.slice(0, 8).map((step) => {
                              const canTakeOverResource = step.type === 'managed_resource' && step.status === 'applied' && step.targetId;
                              const takeoverHref = canTakeOverResource
                                ? buildScopedHref('/resource-control', project.id, selectedEnvironment.id, { resourceId: step.targetId || '' })
                                : '';

                              return (
                                <div
                                  key={`${step.type}-${step.sourceId}-${step.targetId || step.status}`}
                                  className="flex flex-wrap items-center justify-between gap-2"
                                >
                                  <span className={getResourceCopyStepClassName(step.status)}>
                                    {step.title}：{step.description}
                                  </span>
                                  {canTakeOverResource && (
                                    <span className="flex flex-wrap gap-2">
                                      <Link
                                        href={takeoverHref}
                                        className="rounded-md border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent"
                                      >
                                        查看/接管
                                      </Link>
                                      <button
                                        type="button"
                                        onClick={() => handlePostCopyResourceProbe(step.targetId || '')}
                                        disabled={postCopyProbingResourceId === step.targetId}
                                        className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {postCopyProbingResourceId === step.targetId ? '生成中...' : '连接探测计划'}
                                      </button>
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                      {resourceCopySourceEnvironment ? '源环境暂无托管资源或密钥' : '暂无可作为源环境的其他环境'}
                    </div>
                  )}
                </div>
              )}

              {projectEnvironments.length > 1 && (
                <div className="mt-4 rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">跨环境复制 CDN</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        从源环境复制 CDN 配置骨架到当前环境，只创建 pending 配置
                      </div>
                    </div>
                    <Link href={`/cdn-configs?projectId=${project.id}`} className="text-xs font-medium text-primary hover:underline">
                      管理 CDN
                    </Link>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <label className="text-xs">
                      <span className="mb-1 block font-medium">源环境</span>
                      <select
                        value={cdnCopySourceEnvironment?.id || ''}
                        onChange={(event) => setCdnCopySourceEnvironmentId(event.target.value)}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        {selectableCdnCopySourceEnvironments.map((environment) => (
                          <option key={environment.id} value={environment.id}>
                            {environment.name} / {environment.key}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">
                        目标环境：{selectedEnvironment.name} / {selectedEnvironment.key}
                      </div>
                      <div className="mt-1">
                        源环境 CDN {sourceCdnCopyConfigs.length} 个，已填写完整映射 {selectedCdnCopyCount} 个
                        {duplicateCdnCopyDomainCount > 0 ? `，${duplicateCdnCopyDomainCount} 个域名已存在` : ''}
                      </div>
                    </div>
                  </div>

                  {cdnCopySourceEnvironment && sourceCdnCopyConfigs.length > 0 ? (
                    <>
                      <div className="mt-3 space-y-2">
                        {sourceCdnCopyConfigs.map((config) => {
                          const targetDomain = cdnCopyDomainOverrides[config.id] || '';
                          const targetOrigin = cdnCopyOriginOverrides[config.id] || '';
                          const targetCredentialId = cdnCopyCredentialIds[config.id] || '';
                          const normalizedTargetDomain = normalizeDomain(targetDomain);
                          const duplicateTargetDomain = Boolean(
                            normalizedTargetDomain && targetCdnCopyDomains.has(normalizedTargetDomain),
                          );
                          const compatibleCredentials = teamCredentials.filter((credential) =>
                            credential.type === getCdnCredentialType(config.provider),
                          );

                          return (
                            <div
                              key={config.id}
                              className={`rounded-md border p-2 ${
                                duplicateTargetDomain ? 'border-yellow-300 bg-yellow-50' : 'bg-background'
                              }`}
                            >
                              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(220px,300px)_minmax(220px,300px)_minmax(200px,280px)]">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate font-medium" title={config.name}>
                                      {config.name}
                                    </span>
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                                      {getCdnProviderLabel(config.provider)}
                                    </span>
                                    {config.status && (
                                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getResourceStatusClass(config.status)}`}>
                                        {getResourceStatusLabel(config.status)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground" title={config.domain}>
                                    {config.domain}
                                  </div>
                                  <div className="mt-1 truncate text-xs text-muted-foreground" title={config.origin}>
                                    源站 {config.origin}
                                  </div>
                                </div>
                                <label className="text-xs">
                                  <span className="mb-1 block font-medium">目标域名</span>
                                  <input
                                    type="text"
                                    value={targetDomain}
                                    onChange={(event) => handleCdnCopyFieldChange('domain', config.id, event.target.value)}
                                    placeholder="cdn-test.example.com"
                                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                                      duplicateTargetDomain ? 'border-yellow-400' : ''
                                    }`}
                                  />
                                  {duplicateTargetDomain && (
                                    <span className="mt-1 block text-yellow-700">目标环境已存在该域名</span>
                                  )}
                                </label>
                                <label className="text-xs">
                                  <span className="mb-1 block font-medium">目标源站</span>
                                  <input
                                    type="text"
                                    value={targetOrigin}
                                    onChange={(event) => handleCdnCopyFieldChange('origin', config.id, event.target.value)}
                                    placeholder={config.origin || 'https://origin.example.com'}
                                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                  />
                                </label>
                                <label className="text-xs">
                                  <span className="mb-1 block font-medium">目标凭据</span>
                                  <select
                                    value={targetCredentialId}
                                    onChange={(event) => handleCdnCopyFieldChange('credential', config.id, event.target.value)}
                                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                  >
                                    <option value="">选择凭据</option>
                                    {compatibleCredentials.map((credential) => (
                                      <option key={credential.id} value={credential.id}>
                                        {credential.name}
                                      </option>
                                    ))}
                                  </select>
                                  {compatibleCredentials.length === 0 && (
                                    <span className="mt-1 block text-muted-foreground">没有兼容凭据</span>
                                  )}
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          {duplicateCdnCopyDomainCount > 0
                            ? '重复域名会在计划或执行结果里标记为跳过'
                            : '执行后需要再手动同步 CDN provider 和缓存策略'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEnvironmentCdnConfigCopy(true)}
                            disabled={selectedCdnCopyCount === 0 || runningCdnCopyId === `${selectedCdnCopyResultKey}:plan`}
                            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {runningCdnCopyId === `${selectedCdnCopyResultKey}:plan` ? '生成中...' : '预览复制'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEnvironmentCdnConfigCopy(false)}
                            disabled={selectedCdnCopyCount === 0 || runningCdnCopyId === `${selectedCdnCopyResultKey}:apply`}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {runningCdnCopyId === `${selectedCdnCopyResultKey}:apply` ? '创建中...' : '创建 pending CDN'}
                          </button>
                        </div>
                      </div>

                      {selectedCdnCopyResult && (
                        <div className="mt-3 rounded-md bg-muted/50 p-2 text-xs">
                          <div className="font-medium text-foreground">
                            {selectedCdnCopyResult.dryRun ? '最近复制计划' : '最近复制结果'}：
                            {selectedCdnCopyResult.appliedCount > 0
                              ? `已创建 ${selectedCdnCopyResult.appliedCount}`
                              : `计划 ${selectedCdnCopyResult.plannedCount}`}
                            {selectedCdnCopyResult.skippedCount > 0 ? `，跳过 ${selectedCdnCopyResult.skippedCount}` : ''}
                          </div>
                          {selectedCdnCopyResult.warnings.length > 0 && (
                            <div className="mt-2 space-y-1 text-muted-foreground">
                              {selectedCdnCopyResult.warnings.slice(0, 2).map((warning) => (
                                <div key={warning}>{warning}</div>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 space-y-1">
                            {selectedCdnCopyResult.steps.slice(0, 6).map((step) => (
                              <div
                                key={`${step.sourceCdnConfigId}-${step.targetCdnConfigId || step.status}`}
                                className={getCdnCopyStepClassName(step.status)}
                              >
                                {step.title}：{step.description}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                      {cdnCopySourceEnvironment ? '源环境暂无 CDN 配置' : '暂无可作为源环境的其他环境'}
                    </div>
                  )}
                </div>
              )}

              {projectEnvironments.length > 1 && (
                <div className="mt-4 rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">跨环境复制站点</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        从源环境复制 Site 配置骨架到当前环境，只创建 draft 站点
                      </div>
                    </div>
                    <Link href={`/sites?projectId=${project.id}`} className="text-xs font-medium text-primary hover:underline">
                      管理站点
                    </Link>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <label className="text-xs">
                      <span className="mb-1 block font-medium">源环境</span>
                      <select
                        value={siteCopySourceEnvironment?.id || ''}
                        onChange={(event) => setSiteCopySourceEnvironmentId(event.target.value)}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        {selectableSiteCopySourceEnvironments.map((environment) => (
                          <option key={environment.id} value={environment.id}>
                            {environment.name} / {environment.key}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">
                        目标环境：{selectedEnvironment.name} / {selectedEnvironment.key}
                      </div>
                      <div className="mt-1">
                        源环境站点 {sourceSiteCopySites.length} 个，已填写目标域名 {selectedSiteCopyCount} 个
                        {duplicateSiteCopyDomainCount > 0 ? `，${duplicateSiteCopyDomainCount} 个域名已存在` : ''}
                      </div>
                    </div>
                  </div>

                  {siteCopySourceEnvironment && sourceSiteCopySites.length > 0 ? (
                    <>
                      <div className="mt-3 space-y-2">
                        {sourceSiteCopySites.map((site) => {
                          const targetDomain = siteCopyDomainOverrides[site.id] || '';
                          const normalizedTargetDomain = normalizeDomain(targetDomain);
                          const duplicateTargetDomain = Boolean(
                            normalizedTargetDomain && targetSiteCopyDomains.has(normalizedTargetDomain),
                          );

                          return (
                            <div
                              key={site.id}
                              className={`rounded-md border p-2 ${
                                duplicateTargetDomain ? 'border-yellow-300 bg-yellow-50' : 'bg-background'
                              }`}
                            >
                              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(220px,360px)]">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate font-medium" title={site.name}>
                                      {site.name}
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getResourceStatusClass(site.status)}`}>
                                      {getResourceStatusLabel(site.status)}
                                    </span>
                                  </div>
                                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground" title={site.primaryDomain}>
                                    {site.primaryDomain}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {site.runtimeType}
                                    {site.server ? ` · ${site.server.name}` : ''}
                                  </div>
                                </div>
                                <label className="text-xs">
                                  <span className="mb-1 block font-medium">目标域名</span>
                                  <input
                                    type="text"
                                    value={targetDomain}
                                    onChange={(event) => handleSiteCopyDomainChange(site.id, event.target.value)}
                                    placeholder="example.com"
                                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                                      duplicateTargetDomain ? 'border-yellow-400' : ''
                                    }`}
                                  />
                                  {duplicateTargetDomain && (
                                    <span className="mt-1 block text-yellow-700">目标环境已存在该域名</span>
                                  )}
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          {duplicateSiteCopyDomainCount > 0
                            ? '重复域名会在计划或执行结果里标记为跳过'
                            : '执行后需要再手动绑定服务器、同步 Nginx/OpenResty 和证书资产'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEnvironmentSiteCopy(true)}
                            disabled={selectedSiteCopyCount === 0 || runningSiteCopyId === `${selectedSiteCopyResultKey}:plan`}
                            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {runningSiteCopyId === `${selectedSiteCopyResultKey}:plan` ? '生成中...' : '预览复制'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEnvironmentSiteCopy(false)}
                            disabled={selectedSiteCopyCount === 0 || runningSiteCopyId === `${selectedSiteCopyResultKey}:apply`}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {runningSiteCopyId === `${selectedSiteCopyResultKey}:apply` ? '创建中...' : '创建 draft 站点'}
                          </button>
                        </div>
                      </div>

                      {selectedSiteCopyResult && (
                        <div className="mt-3 rounded-md bg-muted/50 p-2 text-xs">
                          <div className="font-medium text-foreground">
                            {selectedSiteCopyResult.dryRun ? '最近复制计划' : '最近复制结果'}：
                            {selectedSiteCopyResult.appliedCount > 0
                              ? `已创建 ${selectedSiteCopyResult.appliedCount}`
                              : `计划 ${selectedSiteCopyResult.plannedCount}`}
                            {selectedSiteCopyResult.skippedCount > 0 ? `，跳过 ${selectedSiteCopyResult.skippedCount}` : ''}
                          </div>
                          {selectedSiteCopyResult.warnings.length > 0 && (
                            <div className="mt-2 space-y-1 text-muted-foreground">
                              {selectedSiteCopyResult.warnings.slice(0, 2).map((warning) => (
                                <div key={warning}>{warning}</div>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 space-y-1">
                            {selectedSiteCopyResult.steps.slice(0, 6).map((step) => {
                              const canTakeOverSite = step.status === 'applied' && step.targetSiteId;
                              const takeoverHref = canTakeOverSite
                                ? buildScopedHref('/sites', project.id, selectedEnvironment.id, { siteId: step.targetSiteId || '' })
                                : '';

                              return (
                                <div
                                  key={`${step.sourceSiteId}-${step.targetSiteId || step.status}`}
                                  className="flex flex-wrap items-center justify-between gap-2"
                                >
                                  <span className={getSiteCopyStepClassName(step.status)}>
                                    {step.title}：{step.description}
                                  </span>
                                  {canTakeOverSite && (
                                    <span className="flex flex-wrap gap-2">
                                      <Link
                                        href={takeoverHref}
                                        className="rounded-md border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent"
                                      >
                                        查看/接管
                                      </Link>
                                      <button
                                        type="button"
                                        onClick={() => handlePostCopySiteSyncPlan(step.targetSiteId || '')}
                                        disabled={postCopyPlanningSiteId === step.targetSiteId}
                                        className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {postCopyPlanningSiteId === step.targetSiteId ? '生成中...' : 'Nginx/OpenResty 计划'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handlePostCopySiteTlsProbe(step.targetSiteId || '')}
                                        disabled={postCopyTlsProbingSiteId === step.targetSiteId}
                                        className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {postCopyTlsProbingSiteId === step.targetSiteId ? '生成中...' : 'TLS 探测计划'}
                                      </button>
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                      {siteCopySourceEnvironment ? '源环境暂无站点' : '暂无可作为源环境的其他环境'}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6">
                <h3 className="mb-2 text-sm font-medium">跨环境对比</h3>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">环境</th>
                        <th className="px-3 py-2 text-left font-medium">服务器</th>
                        <th className="px-3 py-2 text-left font-medium">服务</th>
                        <th className="px-3 py-2 text-left font-medium">资源</th>
                        <th className="px-3 py-2 text-left font-medium">站点/CDN</th>
                        <th className="px-3 py-2 text-left font-medium">部署</th>
                        <th className="px-3 py-2 text-left font-medium">缺口</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {environmentSummaries.map((summary) => (
                        <tr key={summary.environment.id}>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setSelectedEnvironmentId(summary.environment.id)}
                              className="font-medium text-primary hover:underline"
                            >
                              {summary.environment.name}
                            </button>
                            <div className="font-mono text-xs text-muted-foreground">{summary.environment.key}</div>
                          </td>
                          <td className="px-3 py-2">{summary.serverCount}</td>
                          <td className="px-3 py-2">{summary.serviceCount}</td>
                          <td className="px-3 py-2">{summary.resourceCount}</td>
                          <td className="px-3 py-2">{summary.siteCount + summary.cdnCount}</td>
                          <td className="px-3 py-2">{summary.deploymentCount}</td>
                          <td className="px-3 py-2">
                            {summary.gaps.length > 0 ? (
                              <span className="text-xs text-yellow-700">{summary.gaps.join('、')}</span>
                            ) : (
                              <span className="text-xs text-green-700">基础对象齐备</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {environmentConfigProfiles.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">跨环境配置差异</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        参考环境：{configReferenceProfile?.environment.name || '未设置'}，按服务、部署配置、站点、资源和密钥做只读对比
                      </p>
                    </div>
                    <Link href={applicationsHref} className="text-xs text-primary hover:underline">
                      去应用服务补配置
                    </Link>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {environmentConfigProfiles.map((profile) => {
                      const profileSuggestion = environmentSuggestionByEnvironmentId.get(profile.environment.id);
                      const suggestionActions = profileSuggestion?.actions || [];
                      const syncApplyResult = environmentSyncApplyResults[profile.environment.id];

                      return (
                        <div
                          key={profile.environment.id}
                          className={`rounded-md border p-3 ${
                            selectedEnvironment?.id === profile.environment.id ? 'border-primary/60 bg-primary/5' : 'bg-background'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <button
                                type="button"
                                onClick={() => setSelectedEnvironmentId(profile.environment.id)}
                                className="font-medium text-primary hover:underline"
                              >
                                {profile.environment.name}
                              </button>
                              <div className="font-mono text-xs text-muted-foreground">{profile.environment.key}</div>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              profile.differences.length > 0
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {profile.isReference
                                ? '参考环境'
                                : (profile.differences.length > 0 ? `${profile.differences.length} 项差异` : '与参考一致')}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                            <ConfigProfileMetric label="服务集合" value={profile.serviceKeys.length} detail={previewList(profile.serviceKeys)} />
                            <ConfigProfileMetric
                              label="部署配置"
                              value={formatDeployConfigCoverage(profile.deployConfigCoverage)}
                              detail={`健康检查 ${profile.deployConfigCoverage.healthCheckUrl}/${profile.deployConfigCoverage.total}`}
                            />
                            <ConfigProfileMetric
                              label="运行绑定"
                              value={profile.serviceBindingGapCount === 0 ? '完整' : `${profile.serviceBindingGapCount} 缺口`}
                              detail={profile.serverKeys.length > 0 ? previewList(profile.serverKeys) : '未绑定服务器'}
                            />
                            <ConfigProfileMetric
                              label="站点/TLS"
                              value={`${profile.tlsSiteCount}/${profile.siteCount}`}
                              detail={profile.siteRuntimeKeys.length > 0 ? previewList(profile.siteRuntimeKeys) : '暂无站点'}
                            />
                            <ConfigProfileMetric
                              label="资源类型"
                              value={profile.resourceKindKeys.length}
                              detail={profile.resourceKindKeys.length > 0 ? previewList(profile.resourceKindKeys) : '暂无资源'}
                            />
                            <ConfigProfileMetric
                              label="密钥类型"
                              value={profile.secretTypeKeys.length}
                              detail={profile.secretTypeKeys.length > 0 ? previewList(profile.secretTypeKeys) : '暂无密钥'}
                            />
                          </div>

                          <div className="mt-3">
                            {profile.differences.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {profile.differences.map((difference) => (
                                  <span key={difference} className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                                    {difference}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">
                                关键配置与参考环境一致
                              </div>
                            )}
                          </div>

                          {suggestionActions.length > 0 && (
                            <div className="mt-3 border-t pt-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-xs font-medium text-foreground">
                                  同步建议 {suggestionActions.length} 项
                                </div>
                                {!profile.isReference && environmentSyncSuggestions?.referenceEnvironment && (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEnvironmentSyncApply(profile.environment, true)}
                                      disabled={runningEnvironmentSyncId === `${profile.environment.id}:plan`}
                                      className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {runningEnvironmentSyncId === `${profile.environment.id}:plan` ? '生成中...' : '生成计划'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleEnvironmentSyncApply(profile.environment, false)}
                                      disabled={runningEnvironmentSyncId === `${profile.environment.id}:apply`}
                                      className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {runningEnvironmentSyncId === `${profile.environment.id}:apply` ? '应用中...' : '应用服务配置'}
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="mt-2 space-y-1.5">
                                {suggestionActions.slice(0, 4).map((action) => (
                                  <Link
                                    key={`${profile.environment.id}-${action.kind}-${action.title}`}
                                    href={getEnvironmentSuggestionHref(action, project.id, profile.environment.id)}
                                    className={`block text-xs hover:underline ${getSuggestionActionClassName(action.severity)}`}
                                    title={action.description}
                                  >
                                    {action.title}
                                  </Link>
                                ))}
                              </div>
                              {syncApplyResult && (
                                <div className="mt-3 rounded-md bg-muted/50 p-2 text-xs">
                                  <div className="font-medium text-foreground">
                                    {syncApplyResult.dryRun ? '最近计划' : '最近执行'}：
                                    {syncApplyResult.appliedCount > 0
                                      ? `已应用 ${syncApplyResult.appliedCount}`
                                      : `计划 ${syncApplyResult.plannedCount}`}
                                    {syncApplyResult.skippedCount > 0 ? `，待手动处理 ${syncApplyResult.skippedCount}` : ''}
                                  </div>
                                  <div className="mt-2 space-y-1">
                                    {syncApplyResult.steps.slice(0, 5).map((step, index) => (
                                      <div key={`${step.kind}-${index}`} className={getSyncApplyStepClassName(step.status)}>
                                        {step.title}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">服务器</h3>
                    <Link href={`/servers?projectId=${project.id}`} className="text-xs text-primary hover:underline">
                      管理服务器
                    </Link>
                  </div>
                  {environmentServerBindings.length > 0 ? (
                    <div className="divide-y rounded-md border">
                      {environmentServerBindings.map((binding) => (
                        <div key={binding.id} className="px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{binding.server.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getResourceStatusClass(binding.server.status)}`}>
                              {getResourceStatusLabel(binding.server.status)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {binding.server.host}
                            {binding.role ? ` · ${binding.role}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">暂无服务器绑定</p>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">应用服务</h3>
                    <Link href="/applications" className="text-xs text-primary hover:underline">
                      管理服务
                    </Link>
                  </div>
                  {environmentServices.length > 0 ? (
                    <div className="divide-y rounded-md border">
                      {environmentServices.slice(0, 5).map((service) => (
                        <div key={service.id} className="px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{service.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getResourceStatusClass(service.status)}`}>
                              {getResourceStatusLabel(service.status)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {service.applicationName} · {service.kind}
                            {service.runtime ? ` · ${service.runtime}` : ''}
                            {service.server ? ` · ${service.server.name}` : ''}
                            {service.site ? ` · ${service.site.primaryDomain}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">暂无应用服务</p>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">资源</h3>
                    <Link href={`/resource-control?projectId=${project.id}`} className="text-xs text-primary hover:underline">
                      管理资源
                    </Link>
                  </div>
                  {environmentResourceCount > 0 ? (
                    <div className="divide-y rounded-md border">
                      {environmentManagedResources.slice(0, 5).map((resource) => (
                        <div key={resource.id} className="px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{resource.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getResourceStatusClass(resource.status)}`}>
                              {getResourceStatusLabel(resource.status)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {resourceKindLabels[resource.kind] || resource.kind} · {resourceProviderLabels[resource.provider] || resource.provider}
                            {resource.server ? ` · ${resource.server.name}` : ''}
                            {resource.credential ? ` · ${resource.credential.name}` : ''}
                          </div>
                          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                            {resource.endpoint || resource.externalId}
                          </div>
                        </div>
                      ))}
                      {environmentResourceInstances.slice(0, 5).map((instance) => (
                        <div key={instance.id} className="px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{instance.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getResourceStatusClass(instance.status)}`}>
                              {getResourceStatusLabel(instance.status)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {instance.resourceType?.name || '资源实例'}
                            {instance.request ? ` · ${instance.request.title}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">暂无资源绑定</p>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">站点与 CDN</h3>
                    <Link href={`/sites?projectId=${project.id}`} className="text-xs text-primary hover:underline">
                      管理站点
                    </Link>
                  </div>
                  {environmentSites.length > 0 || environmentCdnConfigs.length > 0 ? (
                    <div className="divide-y rounded-md border">
                      {environmentSites.slice(0, 4).map((site) => (
                        <div key={site.id} className="px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{site.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getResourceStatusClass(site.status)}`}>
                              {getResourceStatusLabel(site.status)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {site.primaryDomain} · {site.runtimeType}
                            {site.server ? ` · ${site.server.name}` : ''}
                          </div>
                        </div>
                      ))}
                      {environmentCdnConfigs.slice(0, 4).map((config) => (
                        <div key={config.id} className="px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{config.name}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                              {config.provider}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{config.domain}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">暂无站点或 CDN</p>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">最近部署</h3>
                    <Link href="/execution-governance" className="text-xs text-primary hover:underline">
                      执行治理
                    </Link>
                  </div>
                  {environmentDeployments.length > 0 ? (
                    <div className="divide-y rounded-md border">
                      {environmentDeployments.slice(0, 5).map((run) => (
                        <div key={run.id} className="px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getDeploymentStatusClass(run.status)}`}>
                              {getDeploymentStatusLabel(run.status)}
                            </span>
                            <span className="text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {getDeploymentModeLabel(run.mode || 'deploy')} · {run.branch || run.source}
                            {run.commitSha ? ` · ${run.commitSha.slice(0, 12)}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">暂无部署运行</p>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">密钥</h3>
                    <Link href="/keys" className="text-xs text-primary hover:underline">
                      密钥中心
                    </Link>
                  </div>
                  {environmentSecretKeys.length > 0 ? (
                    <div className="divide-y rounded-md border">
                      {environmentSecretKeys.slice(0, 5).map((secret) => (
                        <div key={secret.id} className="px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{secret.name}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                              {secret.type}
                            </span>
                          </div>
                          {secret.description && (
                            <div className="mt-1 text-xs text-muted-foreground">{secret.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">暂无环境密钥</p>
                  )}
                </section>
              </div>
            </div>
          )}

          {hasDeploymentConfig && (
            <div className="border rounded-lg p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">构建部署</h2>
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={queueDeploymentRun}
                      onChange={(event) => setQueueDeploymentRun(event.target.checked)}
                    />
                    加入 Server executor 队列
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={smokeAutoRollbackOnFailure}
                      onChange={(event) => setSmokeAutoRollbackOnFailure(event.target.checked)}
                    />
                    Live Smoke 失败后自动生成回滚计划
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={postRollbackSmokeOnSuccess}
                      onChange={(event) => setPostRollbackSmokeOnSuccess(event.target.checked)}
                    />
                    Live 回滚完成后自动 Smoke
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCreateDeploymentPlan}
                    disabled={creatingDeploymentRun}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                  >
                    {creatingDeploymentRun ? (queueDeploymentRun ? '入队中...' : '生成中...') : (queueDeploymentRun ? 'Dry-run 入队' : '生成执行计划')}
                  </button>
                  <button
                    onClick={handleRequestLiveDeployment}
                    disabled={requestingLiveDeployment}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {requestingLiveDeployment ? '申请中...' : '申请 Live 部署'}
                  </button>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">部署目标</dt>
                  <dd>{deploymentTargetLabels[deploymentConfig.targetType] || deploymentConfig.targetType || '未配置'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">工作目录</dt>
                  <dd className="font-mono text-xs">{deploymentConfig.workingDirectory || '未配置'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">构建命令</dt>
                  <dd className="font-mono text-xs">{deploymentConfig.buildCommand || '未配置'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">部署命令</dt>
                  <dd className="font-mono text-xs">{deploymentConfig.deployCommand || '未配置'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">健康检查</dt>
                  <dd className="font-mono text-xs">{deploymentConfig.healthCheckUrl || '未配置'}</dd>
                </div>
              </dl>

              <div className="mt-6 border-t pt-4">
                <h3 className="text-sm font-medium">最近部署运行</h3>
                {deploymentRuns.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {deploymentRuns.slice(0, 5).map((run) => {
                      const runMode = run.mode || 'deploy';
                      const steps = readDeploymentCommandSteps(run.commandPlan);
                      const canRollback = run.status === 'completed' && runMode === 'deploy';
                      const canSmokeCheck =
                        run.status === 'completed' && runMode !== 'smoke_check' && Boolean(run.healthCheckUrl);
                      const canRetry = run.status === 'failed' && runMode === 'deploy';
                      const canRequestLiveRetry = canRetry && !run.dryRun;
                      const canRequestFailureRollback =
                        run.status === 'failed' && !run.dryRun && runMode === 'deploy';
                      const canRequestSmokeFailureRollback =
                        run.status === 'failed'
                        && !run.dryRun
                        && runMode === 'smoke_check'
                        && run.sourceRun?.mode === 'deploy';

                      return (
                        <div key={run.id} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getDeploymentStatusClass(run.status)}`}>
                                {getDeploymentStatusLabel(run.status)}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                {getDeploymentModeLabel(runMode)}
                              </span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                                {run.dryRun ? 'Dry-run' : 'Live'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {deploymentTargetLabels[run.targetType] || run.targetType}
                              </span>
                              {(run.projectEnvironment || run.environment) && (
                                <span className="text-xs text-muted-foreground">
                                  {run.projectEnvironment?.name || run.environment}
                                </span>
                              )}
                              {run.serverExecutionJob && (
                                <Link
                                  href="/execution-governance"
                                  className="text-xs text-primary hover:underline"
                                >
                                  Job {run.serverExecutionJob.id.slice(0, 8)} · {getDeploymentStatusLabel(run.serverExecutionJob.status)}
                                </Link>
                              )}
                              {run.operationApproval && (
                                <Link
                                  href="/operation-approvals"
                                  className="text-xs text-primary hover:underline"
                                >
                                  审批 {run.operationApproval.id.slice(0, 8)} · {getOperationApprovalStatusLabel(run.operationApproval.status)}
                                </Link>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {new Date(run.startedAt).toLocaleString()}
                              </span>
                              {canRollback && (
                                <>
                                  <button
                                    onClick={() => handleRollbackDeploymentRun(run)}
                                    disabled={rollingBackRunId === run.id}
                                    className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                                  >
                                    {rollingBackRunId === run.id
                                      ? (queueDeploymentRun ? '入队中...' : '生成中...')
                                      : (queueDeploymentRun ? '回滚 dry-run 入队' : '生成回滚计划')}
                                  </button>
                                  <button
                                    onClick={() => handleRequestLiveRollbackRun(run)}
                                    disabled={requestingLiveRollbackRunId === run.id}
                                    className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    {requestingLiveRollbackRunId === run.id ? '申请中...' : '申请 Live 回滚'}
                                  </button>
                                </>
                              )}
                              {canSmokeCheck && (
                                <>
                                  <button
                                    onClick={() => handleSmokeCheckDeploymentRun(run, true)}
                                    disabled={smokeCheckingRunId === run.id}
                                    className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                                  >
                                    {smokeCheckingRunId === run.id
                                      ? (queueDeploymentRun ? '入队中...' : '生成中...')
                                      : (queueDeploymentRun ? 'Smoke 入队' : 'Smoke 计划')}
                                  </button>
                                  <button
                                    onClick={() => handleSmokeCheckDeploymentRun(run, false)}
                                    disabled={executingLiveSmokeRunId === run.id}
                                    className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                  >
                                    {executingLiveSmokeRunId === run.id
                                      ? (queueDeploymentRun ? '入队中...' : '执行中...')
                                      : (queueDeploymentRun ? 'Live Smoke 入队' : '执行 Smoke')}
                                  </button>
                                </>
                              )}
                              {canRetry && (
                                <button
                                  onClick={() => handleRetryDeploymentRun(run, true)}
                                  disabled={retryingDeploymentRunId === run.id}
                                  className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                                >
                                  {retryingDeploymentRunId === run.id
                                    ? (queueDeploymentRun ? '入队中...' : '生成中...')
                                    : (queueDeploymentRun ? '重试 dry-run 入队' : '生成重试计划')}
                                </button>
                              )}
                              {canRequestLiveRetry && (
                                <button
                                  onClick={() => handleRetryDeploymentRun(run, false)}
                                  disabled={requestingLiveRetryRunId === run.id}
                                  className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  {requestingLiveRetryRunId === run.id ? '申请中...' : '申请 Live 重试'}
                                </button>
                              )}
                              {canRequestFailureRollback && (
                                <button
                                  onClick={() => handleRequestFailureRollbackRun(run)}
                                  disabled={requestingFailureRollbackRunId === run.id}
                                  className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  {requestingFailureRollbackRunId === run.id ? '申请中...' : '申请失败回滚'}
                                </button>
                              )}
                              {canRequestSmokeFailureRollback && (
                                <>
                                  <button
                                    onClick={() => handleSmokeFailureRollbackRun(run, true)}
                                    disabled={requestingSmokeFailureRollbackRunId === run.id}
                                    className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                                  >
                                    {requestingSmokeFailureRollbackRunId === run.id
                                      ? (queueDeploymentRun ? '入队中...' : '生成中...')
                                      : (queueDeploymentRun ? 'Smoke 回滚入队' : '生成 Smoke 回滚计划')}
                                  </button>
                                  <button
                                    onClick={() => handleSmokeFailureRollbackRun(run, false)}
                                    disabled={requestingSmokeFailureRollbackRunId === run.id}
                                    className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    {requestingSmokeFailureRollbackRunId === run.id ? '申请中...' : '申请 Smoke 失败回滚'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {run.sourceRun && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {runMode === 'smoke_check' ? 'Smoke 来源' : '回滚源'}：{run.sourceRun.id.slice(0, 8)}
                              {run.sourceRun.commitSha ? ` · ${run.sourceRun.commitSha.slice(0, 12)}` : ''}
                            </div>
                          )}
                          {run.error && (
                            <p className="mt-2 text-xs text-destructive">{run.error}</p>
                          )}
                          {steps.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {steps.map((step) => (
                                <div key={step.key} className="rounded bg-muted/50 p-2">
                                  <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="font-medium">{step.label}</span>
                                    <span className="text-muted-foreground">
                                      {step.required ? '必需' : '可选'}
                                    </span>
                                  </div>
                                  {step.command ? (
                                    <code className="mt-1 block break-all text-xs text-muted-foreground">
                                      {step.command}
                                    </code>
                                  ) : (
                                    <span className="mt-1 block text-xs text-muted-foreground">未生成命令</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">暂无部署运行记录</p>
                )}
              </div>
            </div>
          )}

          {hasDeploymentConfig && (
            <div className="border rounded-lg p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-semibold">Git Webhook</h2>
                <button
                  onClick={handleCreateWebhook}
                  disabled={creatingWebhook}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  {creatingWebhook
                    ? '创建中...'
                    : webhookTriggerMode === 'pr_preview'
                      ? '创建 PR Preview Webhook'
                      : '创建 Push Webhook'}
                </button>
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-4">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">类型</span>
                  <select
                    value={webhookTriggerMode}
                    onChange={(event) => setWebhookTriggerMode(event.target.value as WebhookTriggerMode)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="push">Push 自动部署</option>
                    <option value="pr_preview">PR Preview</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">目标环境</span>
                  <select
                    value={webhookEnvironmentId}
                    onChange={(event) => setWebhookEnvironmentId(event.target.value)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="">项目默认环境</option>
                    {projectEnvironments.filter((environment) => environment.status === 'active').map((environment) => (
                      <option key={environment.id} value={environment.id}>
                        {environment.name} / {environment.key}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">触发后</span>
                  <select
                    value={webhookTriggerMode === 'pr_preview' ? 'preview' : webhookDeploymentMode}
                    onChange={(event) => setWebhookDeploymentMode(event.target.value as WebhookDeploymentMode)}
                    disabled={webhookTriggerMode === 'pr_preview'}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="dry_run">生成 dry-run 计划</option>
                    <option value="queue">加入 dry-run 队列</option>
                    <option value="live_request">申请 Live 部署</option>
                    {webhookTriggerMode === 'pr_preview' && (
                      <option value="preview">生成 PR Preview 计划</option>
                    )}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">最大尝试</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={webhookMaxAttempts}
                    onChange={(event) => setWebhookMaxAttempts(Math.max(1, Math.min(Number(event.target.value) || 1, 5)))}
                    disabled={webhookTriggerMode === 'push' && webhookDeploymentMode === 'dry_run'}
                    className="w-full rounded-md border px-3 py-2 disabled:bg-muted disabled:text-muted-foreground"
                  />
                </label>
              </div>

              {createdWebhookSecret && (
                <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                  <div className="font-medium">Webhook secret 仅本次显示</div>
                  <code className="mt-1 block break-all text-xs">{createdWebhookSecret}</code>
                </div>
              )}
              <div className="mb-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                Generic 或 x-devpilot-webhook-secret 投递需要在 5 分钟内携带 x-devpilot-webhook-timestamp。
              </div>

              {webhooks.length > 0 ? (
                <div className="space-y-3">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{webhook.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {webhook.provider} · {getWebhookEventTypesLabel(webhook.eventTypes)} · {webhook.branchPattern || '*'}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {webhook.environment?.name || '项目默认环境'} · {getWebhookDeploymentModeLabel(webhook.deploymentMode)}
                            {webhook.deploymentMode === 'queue' || webhook.deploymentMode === 'live_request' ? ` · ${webhook.maxAttempts} 次尝试` : ''}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            webhook.enabled ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                          }`}>
                            {webhook.enabled ? '已启用' : '已停用'}
                          </span>
                          <button
                            onClick={() => handleRotateWebhookSecret(webhook)}
                            disabled={rotatingWebhookId === webhook.id}
                            className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                          >
                            {rotatingWebhookId === webhook.id ? '轮换中...' : '轮换 Secret'}
                          </button>
                        </div>
                      </div>
                      <div className="mt-3">
                        <dt className="text-xs text-muted-foreground">Endpoint</dt>
                        <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">
                          {buildWebhookEndpoint(webhook.urlToken)}
                        </code>
                      </div>
                      {rotatedWebhookSecret?.webhookId === webhook.id && (
                        <div className="mt-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                          <div className="font-medium">新 Webhook secret 仅本次显示</div>
                          <code className="mt-1 block break-all text-xs">{rotatedWebhookSecret.secret}</code>
                        </div>
                      )}
                      {webhook.lastDeliveryAt && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          最近投递：{new Date(webhook.lastDeliveryAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无 Webhook 配置</p>
              )}

              <div className="mt-6 border-t pt-4">
                <h3 className="text-sm font-medium">最近投递</h3>
                {webhookDeliveries.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {webhookDeliveries.slice(0, 5).map((delivery) => (
                      <div key={delivery.id} className="rounded-md bg-muted/50 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getWebhookDeliveryStatusClass(delivery.status)}`}>
                              {getWebhookDeliveryStatusLabel(delivery.status)}
                            </span>
                            <span className="text-xs text-muted-foreground">{delivery.eventType}</span>
                            <span className="text-xs text-muted-foreground">
                              signature: {delivery.signatureStatus}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(delivery.receivedAt).toLocaleString()}
                          </span>
                        </div>
                        {delivery.message && (
                          <p className="mt-2 text-xs text-muted-foreground">{delivery.message}</p>
                        )}
                        {delivery.deploymentRun && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            DeploymentRun: {delivery.deploymentRun.id} · {getDeploymentStatusLabel(delivery.deploymentRun.status)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">暂无 Webhook 投递记录</p>
                )}
              </div>
            </div>
          )}

          {/* 关联的应用服务 */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">应用服务</h2>
              <Link href="/applications" className="text-sm text-primary hover:underline">
                管理
              </Link>
            </div>
            {project.applications && project.applications.length > 0 ? (
              <div className="space-y-3">
                {project.applications.map((application) => (
                  <div key={application.id} className="rounded-md bg-muted/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{application.name}</div>
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
                    {application.services.length > 0 && (
                      <div className="mt-3 grid gap-2">
                        {application.services.slice(0, 4).map((service) => (
                          <div key={service.id} className="rounded bg-background px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">{service.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {service.environment?.name || '未绑定环境'}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {service.kind}
                              {service.runtime ? ` · ${service.runtime}` : ''}
                              {service.server ? ` · ${service.server.name}` : ''}
                              {service.site ? ` · ${service.site.primaryDomain}` : ''}
                              {service.managedResource ? ` · ${service.managedResource.name}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">暂无应用服务</p>
            )}
          </div>

          {/* 关联的站点/代理配置 */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">站点管控</h2>
              <Link href={`/sites?new=true&projectId=${project.id}`} className="text-sm text-primary hover:underline">
                添加
              </Link>
            </div>
            {project.sites && project.sites.length > 0 ? (
              <div className="space-y-2">
                {project.sites.map((site) => (
                  <Link
                    key={site.id}
                    href={`/sites?projectId=${project.id}`}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md hover:bg-muted"
                  >
                    <div>
                      <div className="font-medium">{site.name}</div>
                      <div className="text-sm text-muted-foreground font-mono">{site.primaryDomain}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {site.runtimeType} · {site.environment?.name || '未绑定环境'} · {site.server ? site.server.name : '未关联服务器'}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      site.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {site.status === 'active' ? '已生效' : site.status === 'draft' ? '草稿' : '待同步'}
                    </span>
                  </Link>
                ))}
              </div>
            ) : project.proxyConfigs && project.proxyConfigs.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">当前项目只有旧代理配置，可在站点管控中补建 Site 并关联。</p>
                {project.proxyConfigs.map((config) => (
                  <Link
                    key={config.id}
                    href={`/proxy-configs/${config.id}`}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md hover:bg-muted"
                  >
                      <div>
                        <div className="font-medium">{config.name}</div>
                        <div className="text-sm text-muted-foreground font-mono">{config.domain}</div>
                      </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      config.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {config.status === 'active' ? '已生效' : '待同步'}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">暂无关联站点</p>
            )}
          </div>

          {/* 关联的 CDN 配置 */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">CDN 配置</h2>
              <Link href={`/cdn-configs?new=true&projectId=${project.id}`} className="text-sm text-primary hover:underline">
                添加
              </Link>
            </div>
            {project.cdnConfigs && project.cdnConfigs.length > 0 ? (
              <div className="space-y-2">
                {project.cdnConfigs.map((config) => (
                  <Link
                    key={config.id}
                    href={`/cdn-configs/${config.id}`}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md hover:bg-muted"
                  >
                    <div>
                      <div className="font-medium">{config.name}</div>
                      <div className="text-sm text-muted-foreground font-mono">{config.domain}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {config.environment?.name || '未绑定环境'}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                      {config.provider}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">暂无关联的 CDN 配置</p>
            )}
          </div>
        </div>

        {/* 操作面板 */}
        <div className="space-y-4">
          <div className="border rounded-lg p-6">
            <h2 className="font-semibold mb-4">快捷操作</h2>
            <div className="space-y-2">
              {repository && (
                <a
                  href={repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  查看仓库
                </a>
              )}
              <Link
                href={`/resource-control?projectId=${project.id}`}
                className="w-full px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent flex items-center justify-center"
              >
                查看资源管控
              </Link>
              <Link
                href="/applications"
                className="w-full px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent flex items-center justify-center"
              >
                管理应用服务
              </Link>
              <Link
                href={`/sites?new=true&projectId=${project.id}`}
                className="w-full px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent flex items-center justify-center"
              >
                添加站点
              </Link>
              <Link
                href={`/cdn-configs?new=true&projectId=${project.id}`}
                className="w-full px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent flex items-center justify-center"
              >
                添加 CDN 配置
              </Link>
            </div>
          </div>

          <div className="border rounded-lg p-6 border-destructive/50">
            <h2 className="font-semibold text-destructive mb-4">危险操作</h2>
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除项目
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigProfileMetric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
      <div className="mt-1 truncate text-muted-foreground" title={detail}>
        {detail}
      </div>
    </div>
  );
}

function isDeploymentCommandStep(value: unknown): value is DeploymentCommandStep {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const step = value as Record<string, unknown>;
  return typeof step.key === 'string' && typeof step.label === 'string';
}

function readDeploymentCommandSteps(commandPlan: unknown): DeploymentCommandStep[] {
  const steps = Array.isArray(commandPlan)
    ? commandPlan
    : typeof commandPlan === 'object' && commandPlan !== null && Array.isArray((commandPlan as { steps?: unknown }).steps)
      ? (commandPlan as { steps: unknown[] }).steps
      : [];

  return steps.filter(isDeploymentCommandStep).map((step) => ({
    key: step.key,
    label: step.label,
    command: typeof step.command === 'string' ? step.command : '',
    cwd: typeof step.cwd === 'string' ? step.cwd : '',
    required: step.required === true,
  }));
}

function matchesProjectEnvironment(
  environment: { id?: string | null; key?: string | null; name?: string | null } | null | undefined,
  selectedEnvironment: { id: string; key: string; name: string } | null,
  fallbackEnvironment?: string | null,
) {
  if (!selectedEnvironment) {
    return false;
  }

  if (environment?.id) {
    return environment.id === selectedEnvironment.id;
  }

  if (fallbackEnvironment) {
    return fallbackEnvironment === selectedEnvironment.key || fallbackEnvironment === selectedEnvironment.name;
  }

  return false;
}

function buildEnvironmentConfigProfiles(
  project: Project,
  deploymentRuns: DeploymentRun[],
  environments: NonNullable<Project['environments']>,
): EnvironmentConfigProfile[] {
  const profiles = environments.map((environment) => {
    const services: ProjectServiceWithApplication[] = (project.applications || []).flatMap((application) =>
      application.services
        .filter((service) => matchesProjectEnvironment(service.environment, environment))
        .map((service) => ({ ...service, applicationName: application.name })),
    );
    const sites = (project.sites || []).filter((site) => matchesProjectEnvironment(site.environment, environment));
    const managedResources = (project.managedResources || []).filter((resource) =>
      matchesProjectEnvironment(resource.environment, environment),
    );
    const resourceInstances = (project.resourceInstances || []).filter((instance) =>
      matchesProjectEnvironment(instance.projectEnvironment, environment),
    );
    const secretKeys = (project.secretKeys || []).filter((secret) => matchesProjectEnvironment(secret.environment, environment));
    const deployments = deploymentRuns.filter((run) =>
      matchesProjectEnvironment(run.projectEnvironment, environment, run.environment),
    );
    const serverBindings = environment.serverBindings || [];

    return {
      environment,
      isReference: false,
      serviceKeys: uniqueSorted(services.map((service) => `${service.applicationName}/${service.name}`)),
      serverKeys: uniqueSorted(serverBindings.map((binding) => binding.server.host || binding.server.name)),
      resourceKindKeys: uniqueSorted([
        ...managedResources.map((resource) => `${resourceProviderLabels[resource.provider] || resource.provider}/${resourceKindLabels[resource.kind] || resource.kind}`),
        ...resourceInstances.map((instance) => instance.resourceType?.key || instance.resourceType?.name || 'resource_instance'),
      ]),
      siteRuntimeKeys: uniqueSorted(sites.map((site) => `${site.runtimeType}${site.server ? `@${site.server.name}` : ''}`)),
      secretTypeKeys: uniqueSorted(secretKeys.map((secret) => secret.type)),
      siteCount: sites.length,
      tlsSiteCount: sites.filter((site) => siteTlsEnabled(site)).length,
      serviceBindingGapCount: services.filter((service) => !service.server && !service.site && !service.managedResource).length,
      deployConfigCoverage: buildDeployConfigCoverage(services),
      successfulDeployments: deployments.filter((run) => run.status === 'completed').length,
      differences: [],
    };
  });
  const reference = findConfigReferenceProfile(profiles);

  return profiles.map((profile) => ({
    ...profile,
    isReference: Boolean(reference && profile.environment.id === reference.environment.id),
    differences: reference ? buildConfigDifferences(profile, reference) : [],
  }));
}

function findConfigReferenceProfile(profiles: Omit<EnvironmentConfigProfile, 'differences'>[]) {
  return (
    profiles.find((profile) => ['prod', 'production'].includes(profile.environment.key.toLowerCase())) ||
    profiles.find((profile) => ['prod', 'production', '生产'].some((text) => profile.environment.name.toLowerCase().includes(text))) ||
    profiles[profiles.length - 1] ||
    null
  );
}

function buildDeployConfigCoverage(services: ProjectServiceWithApplication[]): DeployConfigCoverage {
  return {
    total: services.length,
    workingDirectory: services.filter((service) => readConfigString(service.deployConfig, 'workingDirectory')).length,
    buildCommand: services.filter((service) => readConfigString(service.deployConfig, 'buildCommand')).length,
    deployCommand: services.filter((service) => readConfigString(service.deployConfig, 'deployCommand')).length,
    healthCheckUrl: services.filter((service) => readConfigString(service.deployConfig, 'healthCheckUrl')).length,
    rollbackCommand: services.filter((service) => readConfigString(service.deployConfig, 'rollbackCommand')).length,
  };
}

function buildConfigDifferences(
  profile: Omit<EnvironmentConfigProfile, 'differences'>,
  reference: Omit<EnvironmentConfigProfile, 'differences'>,
) {
  if (profile.environment.id === reference.environment.id) {
    return [];
  }

  const differences: string[] = [];
  addSetDifferences(differences, '服务', profile.serviceKeys, reference.serviceKeys);
  addSetDifferences(differences, '资源类型', profile.resourceKindKeys, reference.resourceKindKeys);
  addSetDifferences(differences, '密钥类型', profile.secretTypeKeys, reference.secretTypeKeys);
  addSetDifferences(differences, '站点运行时', profile.siteRuntimeKeys, reference.siteRuntimeKeys);

  if (profile.deployConfigCoverage.total < reference.deployConfigCoverage.total) {
    differences.push(`服务数少 ${reference.deployConfigCoverage.total - profile.deployConfigCoverage.total}`);
  }
  if (profile.deployConfigCoverage.deployCommand < reference.deployConfigCoverage.deployCommand) {
    differences.push(`部署命令少 ${reference.deployConfigCoverage.deployCommand - profile.deployConfigCoverage.deployCommand}`);
  }
  if (profile.deployConfigCoverage.healthCheckUrl < reference.deployConfigCoverage.healthCheckUrl) {
    differences.push(`健康检查少 ${reference.deployConfigCoverage.healthCheckUrl - profile.deployConfigCoverage.healthCheckUrl}`);
  }
  if (profile.serviceBindingGapCount > reference.serviceBindingGapCount) {
    differences.push(`运行绑定缺口多 ${profile.serviceBindingGapCount - reference.serviceBindingGapCount}`);
  }
  if (profile.tlsSiteCount < reference.tlsSiteCount) {
    differences.push(`TLS 站点少 ${reference.tlsSiteCount - profile.tlsSiteCount}`);
  }
  if (profile.successfulDeployments === 0 && reference.successfulDeployments > 0) {
    differences.push('缺成功部署');
  }

  return differences.slice(0, 10);
}

function addSetDifferences(differences: string[], label: string, current: string[], reference: string[]) {
  const missing = reference.filter((item) => !current.includes(item));
  const extra = current.filter((item) => !reference.includes(item));
  if (missing.length > 0) {
    differences.push(`${label}少 ${previewList(missing, 2)}`);
  }
  if (extra.length > 0) {
    differences.push(`${label}多 ${previewList(extra, 2)}`);
  }
}

function uniqueSorted(items: string[]) {
  return Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function readConfigString(config: Record<string, unknown> | null | undefined, key: string) {
  const value = config?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function siteTlsEnabled(site: NonNullable<Project['sites']>[number]) {
  const tls = site.tls;
  if (!tls || typeof tls !== 'object' || Array.isArray(tls)) {
    return false;
  }
  return tls.enabled === true || (typeof tls.type === 'string' && tls.type !== 'none');
}

function formatDeployConfigCoverage(coverage: DeployConfigCoverage) {
  if (coverage.total === 0) {
    return '无服务';
  }
  return `${coverage.deployCommand}/${coverage.total} 部署`;
}

function previewList(items: string[], max = 3) {
  if (items.length === 0) {
    return '无';
  }
  const preview = items.slice(0, max).join('、');
  return items.length > max ? `${preview} 等 ${items.length} 项` : preview;
}

function buildEnvironmentGaps(input: {
  serverCount: number;
  serviceCount: number;
  resourceCount: number;
  siteCount: number;
  deploymentCount: number;
}) {
  const gaps: string[] = [];

  if (input.serverCount === 0) {
    gaps.push('缺服务器');
  }
  if (input.serviceCount === 0) {
    gaps.push('缺应用服务');
  }
  if (input.resourceCount === 0) {
    gaps.push('缺资源');
  }
  if (input.siteCount === 0) {
    gaps.push('缺站点');
  }
  if (input.deploymentCount === 0) {
    gaps.push('暂无部署');
  }

  return gaps;
}

function buildScopedHref(
  path: string,
  projectId: string,
  environmentId?: string | null,
  extraParams: Record<string, string> = {},
) {
  const params = new URLSearchParams(extraParams);
  params.set('projectId', projectId);
  if (environmentId) {
    params.set('environmentId', environmentId);
  }
  return `${path}?${params.toString()}`;
}

function getEnvironmentSuggestionHref(
  action: EnvironmentSyncSuggestionAction,
  projectId: string,
  environmentId: string,
) {
  if (action.target === 'applications' || action.kind === 'run_deployment') {
    return buildScopedHref('/applications', projectId, environmentId);
  }
  if (action.target === 'sites') {
    return buildScopedHref('/sites', projectId, environmentId, { new: 'true' });
  }
  if (action.target === 'keys') {
    return buildScopedHref('/keys', projectId, environmentId);
  }
  if (action.target === 'cdn-configs') {
    return buildScopedHref('/cdn-configs', projectId, environmentId);
  }
  return buildScopedHref('/resource-control', projectId, environmentId);
}

function getSuggestionActionClassName(severity: EnvironmentSyncSuggestionAction['severity']) {
  if (severity === 'critical') {
    return 'text-red-700';
  }
  if (severity === 'warning') {
    return 'text-yellow-700';
  }
  return 'text-primary';
}

function getSyncApplyStepClassName(status: EnvironmentSyncApplyStep['status']) {
  if (status === 'applied') {
    return 'text-green-700';
  }
  if (status === 'skipped') {
    return 'text-muted-foreground';
  }
  return 'text-yellow-700';
}

function getResourceBulkBindStepClassName(status: EnvironmentResourceBulkBindStep['status']) {
  if (status === 'applied') {
    return 'text-green-700';
  }
  if (status === 'skipped') {
    return 'text-muted-foreground';
  }
  return 'text-orange-800';
}

function getSiteCopyStepClassName(status: EnvironmentSiteCopyStep['status']) {
  if (status === 'applied') {
    return 'text-green-700';
  }
  if (status === 'skipped') {
    return 'text-muted-foreground';
  }
  return 'text-yellow-700';
}

function getCdnCopyStepClassName(status: EnvironmentCdnConfigCopyStep['status']) {
  if (status === 'applied') {
    return 'text-green-700';
  }
  if (status === 'skipped') {
    return 'text-muted-foreground';
  }
  return 'text-yellow-700';
}

function getResourceCopyStepClassName(status: EnvironmentResourceCopyStep['status']) {
  if (status === 'applied') {
    return 'text-green-700';
  }
  if (status === 'skipped') {
    return 'text-muted-foreground';
  }
  return 'text-yellow-700';
}

function buildSiteCopyResultKey(sourceEnvironmentId: string, targetEnvironmentId: string) {
  return `${sourceEnvironmentId}:${targetEnvironmentId}`;
}

function buildCopyResultKey(sourceEnvironmentId: string, targetEnvironmentId: string) {
  return `${sourceEnvironmentId}:${targetEnvironmentId}`;
}

function normalizeDomain(domain: string) {
  return domain.trim().toLowerCase();
}

function buildManagedResourceCopyKey(sourceType: string, provider: string, externalId: string) {
  return `${sourceType}:${provider}:${externalId}`;
}

function getCdnProviderLabel(provider: string) {
  if (provider === 'qiniu') return '七牛云';
  if (provider === 'aliyun') return '阿里云';
  if (provider === 'cloudflare') return 'Cloudflare';
  return provider;
}

function getCdnCredentialType(provider: string) {
  return `cdn_${provider}`;
}

function getServerRoleLabel(role?: string | null) {
  return serverRoleOptions.find((option) => option.value === role)?.label || '混合用途';
}

function getServerStatusLabel(status: string) {
  if (status === 'online') return '在线';
  if (status === 'offline') return '离线';
  return '未知';
}

function getServerStatusClassName(status: string) {
  if (status === 'online') return 'text-green-700';
  if (status === 'offline') return 'text-red-700';
  return 'text-muted-foreground';
}

const resourceBulkBindTypeBySelectionKey: Record<EnvironmentResourceBulkBindSelectionKey, EnvironmentResourceBulkBindType> = {
  managedResourceIds: 'managed_resource',
  resourceInstanceIds: 'resource_instance',
  siteIds: 'site',
  cdnConfigIds: 'cdn_config',
  secretKeyIds: 'secret_key',
};

function createEmptyResourceBulkBindSelection(): EnvironmentResourceBulkBindSelection {
  return {
    managedResourceIds: [],
    resourceInstanceIds: [],
    siteIds: [],
    cdnConfigIds: [],
    secretKeyIds: [],
  };
}

function createResourceBulkBindSelection(project: Project): EnvironmentResourceBulkBindSelection {
  return {
    managedResourceIds: (project.managedResources || [])
      .filter((resource) => !resource.environment?.id)
      .map((resource) => resource.id),
    resourceInstanceIds: (project.resourceInstances || [])
      .filter((instance) => !instance.projectEnvironment?.id)
      .map((instance) => instance.id),
    siteIds: (project.sites || [])
      .filter((site) => !site.environment?.id)
      .map((site) => site.id),
    cdnConfigIds: (project.cdnConfigs || [])
      .filter((config) => !config.environment?.id)
      .map((config) => config.id),
    secretKeyIds: (project.secretKeys || [])
      .filter((secret) => !secret.environment?.id)
      .map((secret) => secret.id),
  };
}

function countResourceBulkBindSelection(selection: EnvironmentResourceBulkBindSelection) {
  return Object.values(selection).reduce((total, ids) => total + ids.length, 0);
}

function toggleResourceBulkBindSelection(
  selection: EnvironmentResourceBulkBindSelection,
  key: EnvironmentResourceBulkBindSelectionKey,
  resourceId: string,
  selected: boolean,
): EnvironmentResourceBulkBindSelection {
  const currentIds = selection[key];
  const nextIds = selected
    ? Array.from(new Set([...currentIds, resourceId]))
    : currentIds.filter((id) => id !== resourceId);

  return {
    ...selection,
    [key]: nextIds,
  };
}

function buildResourceBulkBindRequest(selection: EnvironmentResourceBulkBindSelection) {
  const resourceIds = createEmptyResourceBulkBindSelection();
  const resourceTypes: EnvironmentResourceBulkBindType[] = [];

  (Object.keys(resourceBulkBindTypeBySelectionKey) as EnvironmentResourceBulkBindSelectionKey[]).forEach((key) => {
    const selectedIds = selection[key];
    if (selectedIds.length > 0) {
      resourceTypes.push(resourceBulkBindTypeBySelectionKey[key]);
      resourceIds[key] = selectedIds;
    }
  });

  return { resourceTypes, resourceIds };
}

function getEnvironmentGapHref(
  gap: string,
  hrefs: {
    resourceControlHref: string;
    applicationsHref: string;
    siteCreateHref: string;
  },
) {
  if (gap === '缺应用服务' || gap === '暂无部署') {
    return hrefs.applicationsHref;
  }
  if (gap === '缺站点') {
    return hrefs.siteCreateHref;
  }
  return hrefs.resourceControlHref;
}

function getDeploymentStatusLabel(status: string) {
  if (status === 'queued') return '排队中';
  if (status === 'completed') return '已完成';
  if (status === 'blocked') return '已阻塞';
  if (status === 'failed') return '失败';
  if (status === 'running') return '运行中';
  return status;
}

function getDeploymentStatusClass(status: string) {
  if (status === 'queued') return 'bg-indigo-100 text-indigo-700';
  if (status === 'completed') return 'bg-green-100 text-green-700';
  if (status === 'blocked') return 'bg-yellow-100 text-yellow-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  return 'bg-muted text-muted-foreground';
}

function getDeploymentModeLabel(mode: string) {
  if (mode === 'rollback') return '回滚';
  if (mode === 'smoke_check') return 'Smoke';
  return '部署';
}

function getResourceStatusLabel(status: string) {
  if (status === 'active') return '启用';
  if (status === 'inactive') return '停用';
  if (status === 'running') return '运行中';
  if (status === 'stopped') return '已停止';
  if (status === 'online') return '在线';
  if (status === 'offline') return '离线';
  if (status === 'released') return '已释放';
  if (status === 'expired') return '已过期';
  if (status === 'revoked') return '已回收';
  if (status === 'draft') return '草稿';
  if (status === 'synced') return '已同步';
  if (status === 'error') return '异常';
  if (status === 'unknown') return '未知';
  return status;
}

function getResourceStatusClass(status: string) {
  if (status === 'active' || status === 'running' || status === 'online' || status === 'synced') {
    return 'bg-green-100 text-green-700';
  }
  if (status === 'stopped' || status === 'inactive' || status === 'draft' || status === 'unknown') {
    return 'bg-yellow-100 text-yellow-700';
  }
  if (status === 'error' || status === 'offline' || status === 'expired' || status === 'revoked') {
    return 'bg-red-100 text-red-700';
  }
  return 'bg-muted text-muted-foreground';
}

function getOperationApprovalStatusLabel(status: string) {
  if (status === 'pending') return '待审批';
  if (status === 'approved') return '已批准';
  if (status === 'rejected') return '已拒绝';
  if (status === 'cancelled') return '已取消';
  return status;
}

function buildWebhookEndpoint(urlToken: string) {
  return `${API_BASE_URL}/api/webhooks/git/${urlToken}`;
}

function getWebhookDeploymentModeLabel(mode: string) {
  if (mode === 'preview') return 'PR Preview';
  if (mode === 'queue') return '加入 dry-run 队列';
  if (mode === 'live_request') return '申请 Live 部署';
  return '生成 dry-run 计划';
}

function getWebhookEventTypesLabel(eventTypes: unknown) {
  const values = Array.isArray(eventTypes)
    ? eventTypes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const hasPush = values.includes('push');
  const hasPreview = values.includes('pull_request') || values.includes('merge_request');

  if (hasPush && hasPreview) return 'Push + PR Preview';
  if (hasPreview) return 'PR Preview';
  if (hasPush) return 'Push';
  return values.length > 0 ? values.join(', ') : '事件未配置';
}

function getWebhookDeliveryStatusLabel(status: string) {
  if (status === 'accepted') return '已接受';
  if (status === 'ignored') return '已忽略';
  if (status === 'failed') return '失败';
  if (status === 'received') return '已接收';
  return status;
}

function getWebhookDeliveryStatusClass(status: string) {
  if (status === 'accepted') return 'bg-green-100 text-green-700';
  if (status === 'ignored') return 'bg-yellow-100 text-yellow-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  return 'bg-muted text-muted-foreground';
}
