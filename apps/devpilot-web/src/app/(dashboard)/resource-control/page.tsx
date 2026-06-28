'use client';

import { createElement, Suspense as ReactSuspense, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function SuspenseBoundary({ children, fallback }: { children: ReactNode; fallback: ReactNode }): any {
  return createElement(ReactSuspense as any, { fallback }, children);
}

interface Server {
  id: string;
  name: string;
  host: string;
  status: 'online' | 'offline' | 'unknown';
}

interface ManagedResource {
  id: string;
  sourceType: 'server' | 'cloud' | 'manual';
  provider: string;
  kind: string;
  name: string;
  externalId: string;
  status: string;
  endpoint?: string | null;
  metadata?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
  lastSyncAt?: string | null;
  serverId?: string | null;
  server?: Server | null;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  credential?: { id: string; name: string; type: string } | null;
}

interface ProjectEnvironment {
  id: string;
  key: string;
  name: string;
  status: string;
  project?: { id: string; name: string } | null;
}

interface TeamCredential {
  id: string;
  type: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
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

interface CredentialProfile {
  type: string;
  name: string;
  providers: string[];
  resourceKinds?: string[];
  authAdapterKey: string;
  requiredFields: string[];
  optionalFields: string[];
  secretFields: string[];
  futureTransport: string;
}

interface ResourceSyncRun {
  id: string;
  sourceType: string;
  provider: string;
  scope?: string | null;
  status: 'running' | 'completed' | 'failed';
  discovered: number;
  startedAt: string;
  finishedAt?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
  server?: { id: string; name: string; host: string } | null;
  credential?: { id: string; name: string; type: string } | null;
}

interface CloudSyncProviderDiagnostic {
  provider: string;
  syncMode?: string;
  parsedCount?: number;
  skippedCount?: number;
  errors: string[];
  fallbackReason?: string;
  live?: boolean;
  sdk?: string;
  regions: string[];
  requestPolicy?: Record<string, unknown> | null;
}

interface CloudProviderHealthIssue {
  runId: string;
  type: 'sync_failed' | 'provider_failure';
  status: string;
  message: string;
  startedAt: string;
}

interface CloudProviderHealthSummary {
  provider: string;
  status: 'healthy' | 'degraded' | 'error' | 'unknown';
  totalRuns: number;
  liveRuns: number;
  fallbackRuns: number;
  failedRuns: number;
  providerFailureCount: number;
  configFallbackCount: number;
  quotaSignals: number;
  rateLimitSignals: number;
  timeoutSignals: number;
  discovered: number;
  lastRunAt?: string;
  lastStatus?: string;
  lastError?: string;
  sdk?: string;
  regions: string[];
  lastRequestPolicy?: Record<string, unknown> | null;
  recentIssues: CloudProviderHealthIssue[];
}

interface ResourceActionDefinition {
  key: string;
  name: string;
  description: string;
  providers: string[];
  kinds: string[];
  sourceTypes: string[];
  executorKey: string;
  adapterKey: string;
  mode: 'read' | 'mutating' | 'maintenance';
  risk: 'low' | 'medium' | 'high';
  dryRunOnly: boolean;
  requiresConfirmation: boolean;
}

interface ResourceActionRun {
  id: string;
  action: string;
  executorKey: string;
  adapterKey: string;
  dryRun: boolean;
  risk: 'low' | 'medium' | 'high';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked';
  serverExecutionJobId?: string | null;
  serverExecutionJob?: ServerExecutionJobRef | null;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  resource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    sourceType: string;
    endpoint?: string | null;
  } | null;
}

interface ResourceMetricSnapshot {
  id: string;
  resourceId: string;
  resourceActionRunId?: string | null;
  sourceType: string;
  provider: string;
  kind: string;
  metricSource: string;
  status: 'collected' | 'partial';
  sampledAt: string;
  cpuPercent?: number | null;
  memoryUsageBytes?: number | null;
  memoryLimitBytes?: number | null;
  memoryPercent?: number | null;
  networkInputBytes?: number | null;
  networkOutputBytes?: number | null;
  blockInputBytes?: number | null;
  blockOutputBytes?: number | null;
  pids?: number | null;
  resource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    sourceType: string;
    endpoint?: string | null;
  } | null;
  resourceActionRun?: {
    id: string;
    action: string;
    status: string;
    dryRun: boolean;
    startedAt: string;
    finishedAt?: string | null;
  } | null;
}

interface ResourceMetricTrendValue {
  latest: number | null;
  average: number | null;
  max: number | null;
  delta: number | null;
}

interface ResourceMetricTrendSummary {
  id: string;
  resourceId: string;
  sourceType: string;
  provider: string;
  kind: string;
  metricSource: string;
  windowMinutes: number;
  sampleCount: number;
  firstSampledAt: string;
  lastSampledAt: string;
  cpuPercent: ResourceMetricTrendValue;
  memoryPercent: ResourceMetricTrendValue;
  memoryUsageBytes: ResourceMetricTrendValue;
  networkInputBytes: ResourceMetricTrendValue;
  networkOutputBytes: ResourceMetricTrendValue;
  blockInputBytes: ResourceMetricTrendValue;
  blockOutputBytes: ResourceMetricTrendValue;
  pids: ResourceMetricTrendValue;
  resource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    sourceType: string;
    endpoint?: string | null;
  } | null;
}

type ResourceMetricSeriesMetric =
  | 'cpuPercent'
  | 'memoryPercent'
  | 'memoryUsageBytes'
  | 'networkInputBytes'
  | 'networkOutputBytes'
  | 'blockInputBytes'
  | 'blockOutputBytes'
  | 'pids';

interface ResourceMetricSeriesPoint {
  snapshotId: string;
  sampledAt: string;
  value?: number | null;
  status: string;
}

interface ResourceMetricSeries {
  id: string;
  resourceId: string;
  sourceType: string;
  provider: string;
  kind: string;
  metricSource: string;
  metric: ResourceMetricSeriesMetric;
  windowMinutes: number;
  limit: number;
  sampleCount: number;
  firstSampledAt: string;
  lastSampledAt: string;
  summary: ResourceMetricTrendValue;
  points: ResourceMetricSeriesPoint[];
  resource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    sourceType: string;
    endpoint?: string | null;
  } | null;
}

interface ResourceConnectionRun {
  id: string;
  authAdapterKey: string;
  executorKey: string;
  adapterKey: string;
  dryRun: boolean;
  sourceType: string;
  provider: string;
  kind: string;
  status: 'running' | 'completed' | 'failed' | 'blocked';
  targetEndpoint?: string | null;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  resource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    sourceType: string;
    endpoint?: string | null;
  } | null;
}

interface ResourceQueryRun {
  id: string;
  queryType: string;
  query?: string | null;
  authAdapterKey: string;
  executorKey: string;
  adapterKey: string;
  dryRun: boolean;
  sourceType: string;
  provider: string;
  kind: string;
  status: 'running' | 'completed' | 'failed' | 'blocked';
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  result?: ResourceQueryRunResult | null;
  resource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    sourceType: string;
    endpoint?: string | null;
  } | null;
}

interface ResourceQueryRunResult {
  mode?: string;
  executed?: boolean;
  adapterState?: {
    current?: string;
    executable?: boolean;
    nextExecutorBoundary?: string;
  };
  preview?: QueryResultPreview;
  livePrerequisites?: Array<{
    key: string;
    status: string;
    detail?: string;
  }>;
  warnings?: string[];
}

interface QueryResultPreview {
  source?: string;
  sample?: boolean;
  shape?: string;
  columns?: Array<{
    key: string;
    label: string;
    type?: string;
    masked?: boolean;
  }>;
  rows?: Array<Record<string, unknown>>;
  pageInfo?: {
    limit?: number;
    returned?: number;
    hasMore?: boolean;
    cursor?: string | null;
    nextCursor?: string | null;
  };
  redaction?: {
    enabled?: boolean;
    maskedColumnKeys?: string[];
  };
  notes?: string[];
}

interface CapabilityResponse {
  syncMode: string;
  executionMode?: string;
  executorAdapters?: Array<{
    key: string;
    currentTransport: string;
    currentAdapter?: string;
    futureTransport: string;
  }>;
  credentialAuthAdapters?: Array<{
    key: string;
    source: string;
    currentStatus: string;
    futureTransport: string;
  }>;
  credentialProfiles?: CredentialProfile[];
  queryAdapters?: Array<{
    key: string;
    sourceTypes: string[];
    currentStatus: string;
    futureTransport: string;
  }>;
  sourceTypes: Array<{
    key: string;
    name: string;
    description: string;
    adapters: Array<{
      provider: string;
      status: string;
      resourceKinds: string[];
      nextStep?: string;
      credentialType?: string;
    }>;
  }>;
  plannedActions: string[];
  reusableSvtonResources: string[];
  safetyNotes: string[];
}

const kindLabels: Record<string, string> = {
  docker_container: 'Docker 容器',
  mysql: 'MySQL',
  redis: 'Redis',
  database: '数据库',
  log_service: '日志服务',
  object_storage: '对象存储',
};

const providerLabels: Record<string, string> = {
  docker: 'Docker',
  'aliyun-rds': '阿里云 RDS',
  'aliyun-sls': '阿里云 SLS',
  'tencent-cos': '腾讯云 COS',
  all: '全部云资源',
};

const defaultCredentialProfiles: CredentialProfile[] = [
  {
    type: 'cloud_aliyun',
    name: '阿里云 AccessKey',
    providers: ['aliyun-rds', 'aliyun-sls'],
    authAdapterKey: 'aliyun-team-credential',
    requiredFields: ['accessKeyId', 'accessKeySecret'],
    optionalFields: ['securityToken', 'defaultRegion', 'accountId'],
    secretFields: ['accessKeySecret', 'securityToken'],
    futureTransport: 'aliyun_provider_sdk',
  },
  {
    type: 'cloud_tencent',
    name: '腾讯云 SecretId',
    providers: ['tencent-cos'],
    authAdapterKey: 'tencent-team-credential',
    requiredFields: ['secretId', 'secretKey'],
    optionalFields: ['defaultRegion', 'appId'],
    secretFields: ['secretKey'],
    futureTransport: 'tencent_cloud_sdk',
  },
  {
    type: 'db_mysql_readonly',
    name: 'MySQL/RDS 只读账号',
    providers: ['docker', 'aliyun-rds'],
    resourceKinds: ['mysql', 'database'],
    authAdapterKey: 'mysql-readonly-team-credential',
    requiredFields: ['host', 'port', 'username', 'password'],
    optionalFields: ['database', 'sslMode'],
    secretFields: ['password'],
    futureTransport: 'mysql_driver_adapter',
  },
  {
    type: 'db_redis_readonly',
    name: 'Redis 只读账号',
    providers: ['docker'],
    resourceKinds: ['redis'],
    authAdapterKey: 'redis-readonly-team-credential',
    requiredFields: ['host', 'port', 'password'],
    optionalFields: ['username', 'database'],
    secretFields: ['password'],
    futureTransport: 'redis_driver_adapter',
  },
];

const statusClasses: Record<string, string> = {
  queued: 'bg-blue-100 text-blue-700',
  running: 'bg-green-100 text-green-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  collected: 'bg-green-100 text-green-700',
  stopped: 'bg-gray-100 text-gray-700',
  inactive: 'bg-gray-100 text-gray-700',
  unknown: 'bg-yellow-100 text-yellow-700',
  stale: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  error: 'bg-red-100 text-red-700',
  blocked: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-yellow-100 text-yellow-700',
};

export default function ResourceControlPage() {
  return (
    <SuspenseBoundary fallback={<div className="text-center py-12 text-muted-foreground">加载中...</div>}>
      <ResourceControlContent />
    </SuspenseBoundary>
  );
}

function ResourceControlContent() {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get('projectId') || 'all';
  const queryEnvironmentId = searchParams.get('environmentId') || 'all';
  const queryResourceId = searchParams.get('resourceId') || '';
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [credentials, setCredentials] = useState<TeamCredential[]>([]);
  const [syncRuns, setSyncRuns] = useState<ResourceSyncRun[]>([]);
  const [cloudProviderHealth, setCloudProviderHealth] = useState<CloudProviderHealthSummary[]>([]);
  const [actions, setActions] = useState<ResourceActionDefinition[]>([]);
  const [actionRuns, setActionRuns] = useState<ResourceActionRun[]>([]);
  const [metricSnapshots, setMetricSnapshots] = useState<ResourceMetricSnapshot[]>([]);
  const [metricTrends, setMetricTrends] = useState<ResourceMetricTrendSummary[]>([]);
  const [metricSeries, setMetricSeries] = useState<ResourceMetricSeries[]>([]);
  const [metricSeriesMetric, setMetricSeriesMetric] = useState<ResourceMetricSeriesMetric>('cpuPercent');
  const [metricSeriesWindowMinutes, setMetricSeriesWindowMinutes] = useState('360');
  const [loadingMetricSeries, setLoadingMetricSeries] = useState(false);
  const [connectionRuns, setConnectionRuns] = useState<ResourceConnectionRun[]>([]);
  const [queryRuns, setQueryRuns] = useState<ResourceQueryRun[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityResponse | null>(null);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [selectedCloudCredentialId, setSelectedCloudCredentialId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(queryProjectId);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(queryEnvironmentId);
  const [cloudProvider, setCloudProvider] = useState<'all' | 'aliyun-rds' | 'aliyun-sls' | 'tencent-cos'>('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterProvider, setFilterProvider] = useState('all');
  const [queueResourceActions, setQueueResourceActions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [probingResource, setProbingResource] = useState<string | null>(null);
  const [queryingResource, setQueryingResource] = useState<string | null>(null);
  const [bindingResource, setBindingResource] = useState<ManagedResource | null>(null);
  const [bindingForm, setBindingForm] = useState({
    environmentId: '',
    serverId: '',
    credentialId: '',
    queryCredentialId: '',
  });
  const [savingBinding, setSavingBinding] = useState(false);
  const [queryResource, setQueryResource] = useState<ManagedResource | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [queryForm, setQueryForm] = useState({
    queryType: 'metadata',
    query: '',
    limit: 100,
  });
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [savingCredential, setSavingCredential] = useState(false);
  const [deletingCredential, setDeletingCredential] = useState<string | null>(null);
  const [credentialForm, setCredentialForm] = useState({
    name: '',
    type: 'cloud_aliyun',
    accessKeyId: '',
    accessKeySecret: '',
    securityToken: '',
    secretId: '',
    secretKey: '',
    defaultRegion: '',
    accountId: '',
    appId: '',
    host: '',
    port: '',
    username: '',
    password: '',
    database: '',
    sslMode: '',
  });
  const [error, setError] = useState('');

  const loadData = async () => {
    setError('');
    try {
      const [
        resourceData,
        serverData,
        environmentData,
        credentialData,
        runData,
        providerHealthData,
        actionData,
        actionRunData,
        metricSnapshotData,
        metricTrendData,
        connectionRunData,
        queryRunData,
        capabilityData,
      ] = await Promise.all([
        api.get<ManagedResource[]>('/resource-control/resources'),
        api.get<Server[]>('/servers'),
        api.get<ProjectEnvironment[]>('/project-environments', { params: { status: 'active' } }),
        api.get<TeamCredential[]>('/team-credentials'),
        api.get<ResourceSyncRun[]>('/resource-control/sync-runs'),
        api.get<CloudProviderHealthSummary[]>('/resource-control/cloud/provider-health'),
        api.get<ResourceActionDefinition[]>('/resource-control/actions'),
        api.get<ResourceActionRun[]>('/resource-control/action-runs'),
        api.get<ResourceMetricSnapshot[]>('/resource-control/metric-snapshots'),
        api.get<ResourceMetricTrendSummary[]>('/resource-control/metric-trends'),
        api.get<ResourceConnectionRun[]>('/resource-control/connection-runs'),
        api.get<ResourceQueryRun[]>('/resource-control/query-runs'),
        api.get<CapabilityResponse>('/resource-control/capabilities'),
      ]);
      setResources(resourceData);
      setServers(serverData);
      setEnvironments(environmentData);
      setCredentials(credentialData);
      setSyncRuns(runData);
      setCloudProviderHealth(providerHealthData);
      setActions(actionData);
      setActionRuns(actionRunData);
      setMetricSnapshots(metricSnapshotData);
      setMetricTrends(metricTrendData);
      setConnectionRuns(connectionRunData);
      setQueryRuns(queryRunData);
      setCapabilities(capabilityData);
      if (!selectedServerId && serverData.length > 0) {
        setSelectedServerId(serverData[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载资源管控数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedProjectId(queryProjectId);
    setSelectedEnvironmentId(queryEnvironmentId);
    setBindingForm((current) => (
      queryEnvironmentId === 'all' || current.environmentId
        ? current
      : { ...current, environmentId: queryEnvironmentId }
    ));
  }, [queryEnvironmentId, queryProjectId]);

  useEffect(() => {
    if (!queryResourceId) {
      return;
    }
    if (resources.some((resource) => resource.id === queryResourceId)) {
      setSelectedResourceId(queryResourceId);
    }
  }, [queryResourceId, resources]);

  useEffect(() => {
    let cancelled = false;

    const loadMetricSeries = async () => {
      if (!selectedResourceId) {
        setMetricSeries([]);
        setLoadingMetricSeries(false);
        return;
      }

      setLoadingMetricSeries(true);
      try {
        const data = await api.get<ResourceMetricSeries[]>('/resource-control/metric-series', {
          params: {
            resourceId: selectedResourceId,
            metric: metricSeriesMetric,
            windowMinutes: metricSeriesWindowMinutes,
            limit: '240',
          },
        });
        if (!cancelled) {
          setMetricSeries(data);
        }
      } catch (err) {
        if (!cancelled) {
          setMetricSeries([]);
          setError(err instanceof Error ? err.message : '加载指标时序失败');
        }
      } finally {
        if (!cancelled) {
          setLoadingMetricSeries(false);
        }
      }
    };

    loadMetricSeries();

    return () => {
      cancelled = true;
    };
  }, [metricSeriesMetric, metricSeriesWindowMinutes, metricSnapshots, selectedResourceId]);

  const projectOptions = useMemo(() => {
    const options = new Map<string, string>();
    environments.forEach((environment) => {
      if (environment.project?.id) {
        options.set(environment.project.id, environment.project.name);
      }
    });
    resources.forEach((resource) => {
      if (resource.project?.id) {
        options.set(resource.project.id, resource.project.name);
      }
    });
    return Array.from(options.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [environments, resources]);

  const scopedEnvironments = useMemo(() => (
    selectedProjectId === 'all'
      ? environments
      : environments.filter((environment) => environment.project?.id === selectedProjectId)
  ), [environments, selectedProjectId]);

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const sourceMatched = filterSource === 'all' || resource.sourceType === filterSource;
      const providerMatched = filterProvider === 'all' || resource.provider === filterProvider;
      const projectMatched = selectedProjectId === 'all' || resource.project?.id === selectedProjectId;
      const environmentMatched = selectedEnvironmentId === 'all' || resource.environment?.id === selectedEnvironmentId;
      return sourceMatched && providerMatched && projectMatched && environmentMatched;
    });
  }, [filterProvider, filterSource, resources, selectedEnvironmentId, selectedProjectId]);

  const serverGroups = useMemo(() => {
    return servers.map((server) => ({
      server,
      resources: filteredResources.filter(
        (resource) => resource.sourceType === 'server' && (resource.serverId === server.id || resource.server?.id === server.id),
      ),
    }));
  }, [filteredResources, servers]);

  const cloudResources = filteredResources.filter((resource) => resource.sourceType === 'cloud');
  const cloudCredentials = useMemo(
    () => credentials.filter((credential) => isOperationCredential(credential)),
    [credentials],
  );
  const cloudCredentialProfiles = capabilities?.credentialProfiles || defaultCredentialProfiles;
  const selectedCredentialProfile = cloudCredentialProfiles.find((profile) => profile.type === credentialForm.type);
  const cloudSyncCredentials = useMemo(
    () => credentialOptionsForProvider(cloudProvider, credentials, selectedCloudCredentialId),
    [cloudProvider, credentials, selectedCloudCredentialId],
  );
  const bindingCredentialOptions = useMemo(
    () => credentialOptionsForProvider(bindingResource?.provider || 'all', credentials, bindingForm.credentialId),
    [bindingForm.credentialId, bindingResource?.provider, credentials],
  );
  const bindingQueryCredentialOptions = useMemo(
    () => queryCredentialOptionsForResource(bindingResource, credentials, bindingForm.queryCredentialId),
    [bindingForm.queryCredentialId, bindingResource, credentials],
  );
  const selectedResource = useMemo(
    () => resources.find((resource) => resource.id === selectedResourceId) || null,
    [resources, selectedResourceId],
  );
  const selectedResourceActionRuns = useMemo(
    () => filterRunsByResource(actionRuns, selectedResourceId),
    [actionRuns, selectedResourceId],
  );
  const selectedResourceMetricSnapshots = useMemo(
    () => filterMetricSnapshotsByResource(metricSnapshots, selectedResourceId),
    [metricSnapshots, selectedResourceId],
  );
  const selectedResourceMetricTrend = useMemo(
    () => metricTrends.find((trend) => trend.resourceId === selectedResourceId || trend.resource?.id === selectedResourceId) || null,
    [metricTrends, selectedResourceId],
  );
  const selectedResourceMetricSeries = useMemo(
    () => metricSeries.find((series) => series.resourceId === selectedResourceId || series.resource?.id === selectedResourceId) || null,
    [metricSeries, selectedResourceId],
  );
  const latestMetricByResourceId = useMemo(
    () => buildLatestMetricSnapshotMap(metricSnapshots),
    [metricSnapshots],
  );
  const metricTrendByResourceId = useMemo(
    () => buildMetricTrendMap(metricTrends),
    [metricTrends],
  );
  const selectedResourceConnectionRuns = useMemo(
    () => filterRunsByResource(connectionRuns, selectedResourceId),
    [connectionRuns, selectedResourceId],
  );
  const selectedResourceQueryRuns = useMemo(
    () => filterRunsByResource(queryRuns, selectedResourceId),
    [queryRuns, selectedResourceId],
  );

  const stats = useMemo(() => {
    const activeCount = filteredResources.filter((resource) => ['active', 'running'].includes(resource.status)).length;
    return {
      total: filteredResources.length,
      server: filteredResources.filter((resource) => resource.sourceType === 'server').length,
      cloud: filteredResources.filter((resource) => resource.sourceType === 'cloud').length,
      active: activeCount,
    };
  }, [filteredResources]);

  const handleProjectFilterChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    if (projectId !== 'all' && selectedEnvironmentId !== 'all') {
      const selectedEnvironment = environments.find((environment) => environment.id === selectedEnvironmentId);
      if (selectedEnvironment?.project?.id !== projectId) {
        setSelectedEnvironmentId('all');
      }
    }
  };

  const syncServerDocker = async () => {
    if (!selectedServerId) {
      alert('请先选择服务器');
      return;
    }
    setSyncing(`server:${selectedServerId}`);
    setError('');
    try {
      await api.post(`/resource-control/servers/${selectedServerId}/sync-docker`, {
        environmentId: selectedEnvironmentId === 'all' ? undefined : selectedEnvironmentId,
        includeContainers: true,
        includeMiddleware: true,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步服务器 Docker 资源失败');
    } finally {
      setSyncing(null);
    }
  };

  const syncCloud = async () => {
    setSyncing(`cloud:${cloudProvider}`);
    setError('');
    try {
      await api.post('/resource-control/cloud/sync', {
        provider: cloudProvider,
        credentialId: selectedCloudCredentialId || undefined,
        environmentId: selectedEnvironmentId === 'all' ? undefined : selectedEnvironmentId,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步云资源失败');
    } finally {
      setSyncing(null);
    }
  };

  const createCloudCredential = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingCredential(true);
    setError('');
    try {
      await api.post('/team-credentials', {
        name: credentialForm.name,
        type: credentialForm.type,
        config: buildCredentialConfig(credentialForm),
      });
      setCredentialForm({
        name: '',
        type: credentialForm.type,
        accessKeyId: '',
        accessKeySecret: '',
        securityToken: '',
        secretId: '',
        secretKey: '',
        defaultRegion: '',
        accountId: '',
        appId: '',
        host: '',
        port: '',
        username: '',
        password: '',
        database: '',
        sslMode: '',
      });
      setShowCredentialForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建云凭据失败');
    } finally {
      setSavingCredential(false);
    }
  };

  const deleteCloudCredential = async (credential: TeamCredential) => {
    if (!confirm(`确定删除凭据 ${credential.name} 吗？`)) return;
    setDeletingCredential(credential.id);
    setError('');
    try {
      await api.delete(`/team-credentials/${credential.id}`);
      if (selectedCloudCredentialId === credential.id) {
        setSelectedCloudCredentialId('');
      }
      if (bindingForm.credentialId === credential.id || bindingForm.queryCredentialId === credential.id) {
        setBindingForm({
          ...bindingForm,
          credentialId: bindingForm.credentialId === credential.id ? '' : bindingForm.credentialId,
          queryCredentialId: bindingForm.queryCredentialId === credential.id ? '' : bindingForm.queryCredentialId,
        });
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除云凭据失败');
    } finally {
      setDeletingCredential(null);
    }
  };

  const openBindingPanel = (resource: ManagedResource) => {
    setBindingResource(resource);
    setBindingForm({
      environmentId: resource.environment?.id || '',
      serverId: resource.server?.id || resource.serverId || '',
      credentialId: resource.credential?.id || '',
      queryCredentialId: queryCredentialIdOf(resource) || '',
    });
  };

  const saveResourceBinding = async () => {
    if (!bindingResource) return;
    setSavingBinding(true);
    setError('');
    try {
      await api.put(`/resource-control/resources/${bindingResource.id}/binding`, {
        environmentId: bindingForm.environmentId || null,
        serverId: bindingForm.serverId || null,
        credentialId: bindingForm.credentialId || null,
        queryCredentialId: bindingForm.queryCredentialId || null,
        reason: 'resource-control page binding update',
      });
      setBindingResource(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存资源绑定失败');
    } finally {
      setSavingBinding(false);
    }
  };

  const runResourceActionPlan = async (resource: ManagedResource, action: ResourceActionDefinition) => {
    setRunningAction(`${resource.id}:${action.key}`);
    setError('');
    try {
      await api.post(`/resource-control/resources/${resource.id}/actions`, {
        action: action.key,
        dryRun: true,
        queue: queueResourceActions,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建资源动作计划失败');
    } finally {
      setRunningAction(null);
    }
  };

  const probeResourceConnection = async (resource: ManagedResource) => {
    setProbingResource(resource.id);
    setError('');
    try {
      await api.post(`/resource-control/resources/${resource.id}/connection-probe`, {
        dryRun: true,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成资源连接探测计划失败');
    } finally {
      setProbingResource(null);
    }
  };

  const openQueryComposer = (resource: ManagedResource) => {
    const queryType = defaultQueryType(resource);
    setQueryResource(resource);
    setQueryForm({
      queryType,
      query: defaultQueryText(resource, queryType),
      limit: 100,
    });
  };

  const runResourceQuery = async (dryRun: boolean) => {
    if (!queryResource) return;
    setQueryingResource(queryResource.id);
    setError('');
    try {
      const params: Record<string, string | number> = { limit: queryForm.limit };
      if (queryForm.queryType === 'cos_list') {
        params.prefix = queryForm.query;
      }
      if (!dryRun) {
        params.confirmLiveRead = 'true';
      }
      await api.post(`/resource-control/resources/${queryResource.id}/query-runs`, {
        dryRun,
        queryType: queryForm.queryType,
        query: queryForm.query,
        params,
      });
      setQueryResource(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成资源只读查询计划失败');
    } finally {
      setQueryingResource(null);
    }
  };

  const runResourceQueryPlan = () => runResourceQuery(true);

  const runResourceQueryLive = async () => {
    if (!queryResource) return;
    if (!canRunLiveQuery(queryResource)) {
      setError('请先为该 DB/Redis 资源绑定查询凭据');
      return;
    }
    if (!confirm(`将使用已绑定只读凭据查询真实资源 ${queryResource.name}，确认继续吗？`)) {
      return;
    }
    await runResourceQuery(false);
  };

  const runResourceActionLive = async (resource: ManagedResource, action: ResourceActionDefinition) => {
    setRunningAction(`${resource.id}:${action.key}:live`);
    setError('');
    try {
      await api.post(`/resource-control/resources/${resource.id}/actions`, {
        action: action.key,
        dryRun: false,
        queue: queueResourceActions,
        confirmationText: resource.name,
        approvalReason: `申请对资源 ${resource.name} 执行 ${action.name}`,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行 live 资源动作失败');
    } finally {
      setRunningAction(null);
    }
  };

  const getResourceActions = (resource: ManagedResource) => {
    return actions.filter((action) => (
      action.sourceTypes.includes(resource.sourceType) &&
      action.providers.includes(resource.provider) &&
      action.kinds.includes(resource.kind)
    ));
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">资源管控</h1>
          <p className="text-muted-foreground mt-1">
            按服务器和云账号纳管 Docker、数据库、缓存、日志和对象存储资源
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={selectedProjectId}
            onChange={(event) => handleProjectFilterChange(event.target.value)}
            className="px-3 py-1.5 border rounded-md bg-background text-sm"
          >
            <option value="all">全部项目</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <select
            value={selectedEnvironmentId}
            onChange={(event) => setSelectedEnvironmentId(event.target.value)}
            className="px-3 py-1.5 border rounded-md bg-background text-sm"
          >
            <option value="all">全部环境</option>
            {scopedEnvironments.map((environment) => (
              <option key={environment.id} value={environment.id}>
                {environment.project?.name ? `${environment.project.name} / ` : ''}{environment.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
            <input
              type="checkbox"
              checked={queueResourceActions}
              onChange={(event) => setQueueResourceActions(event.target.checked)}
              className="h-4 w-4"
            />
            <span>资源动作入队</span>
          </label>
          <button
            onClick={loadData}
            className="px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
          >
            刷新
          </button>
        </div>
      </div>

      {(selectedProjectId !== 'all' || selectedEnvironmentId !== 'all') && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          当前上下文：
          <span className="ml-1 font-medium text-foreground">
            {getProjectLabel(projectOptions, selectedProjectId)}
          </span>
          <span className="mx-1">/</span>
          <span className="font-medium text-foreground">
            {getEnvironmentLabel(environments, selectedEnvironmentId)}
          </span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="全部资源" value={stats.total} />
        <Metric label="服务器资源" value={stats.server} />
        <Metric label="云资源" value={stats.cloud} />
        <Metric label="运行/可用" value={stats.active} />
      </div>

      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-semibold">操作凭据</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {cloudCredentialProfiles.map((profile) => (
                <span key={profile.type} className="px-2 py-0.5 text-xs rounded-full bg-muted">
                  {profile.name} · {profile.authAdapterKey}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowCredentialForm((value) => !value)}
            className="px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
          >
            {showCredentialForm ? '收起' : '添加凭据'}
          </button>
        </div>

        {showCredentialForm && (
          <form onSubmit={createCloudCredential} className="grid gap-3 lg:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">名称</span>
              <input
                value={credentialForm.name}
                onChange={(event) => setCredentialForm({ ...credentialForm, name: event.target.value })}
                required
                className="w-full px-3 py-2 border rounded-md bg-background"
                placeholder="prod cloud account"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">类型</span>
              <select
                value={credentialForm.type}
                onChange={(event) => setCredentialForm({ ...credentialForm, type: event.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                {cloudCredentialProfiles.map((profile) => (
                  <option key={profile.type} value={profile.type}>
                    {profile.name}
                  </option>
                ))}
              </select>
              {selectedCredentialProfile && (
                <span className="block text-xs text-muted-foreground">
                  {selectedCredentialProfile.futureTransport}
                </span>
              )}
            </label>
            {credentialForm.type === 'cloud_aliyun' ? (
              <>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">AccessKey ID</span>
                  <input
                    value={credentialForm.accessKeyId}
                    onChange={(event) => setCredentialForm({ ...credentialForm, accessKeyId: event.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">AccessKey Secret</span>
                  <input
                    type="password"
                    value={credentialForm.accessKeySecret}
                    onChange={(event) => setCredentialForm({ ...credentialForm, accessKeySecret: event.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">默认地域</span>
                  <input
                    value={credentialForm.defaultRegion}
                    onChange={(event) => setCredentialForm({ ...credentialForm, defaultRegion: event.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="cn-hangzhou"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Account ID</span>
                  <input
                    value={credentialForm.accountId}
                    onChange={(event) => setCredentialForm({ ...credentialForm, accountId: event.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </label>
                <label className="space-y-1 text-sm lg:col-span-2">
                  <span className="font-medium">Security Token</span>
                  <input
                    type="password"
                    value={credentialForm.securityToken}
                    onChange={(event) => setCredentialForm({ ...credentialForm, securityToken: event.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
                  />
                </label>
              </>
            ) : credentialForm.type === 'cloud_tencent' ? (
              <>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Secret ID</span>
                  <input
                    value={credentialForm.secretId}
                    onChange={(event) => setCredentialForm({ ...credentialForm, secretId: event.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Secret Key</span>
                  <input
                    type="password"
                    value={credentialForm.secretKey}
                    onChange={(event) => setCredentialForm({ ...credentialForm, secretKey: event.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">默认地域</span>
                  <input
                    value={credentialForm.defaultRegion}
                    onChange={(event) => setCredentialForm({ ...credentialForm, defaultRegion: event.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="ap-shanghai"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">App ID</span>
                  <input
                    value={credentialForm.appId}
                    onChange={(event) => setCredentialForm({ ...credentialForm, appId: event.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Host</span>
                  <input
                    value={credentialForm.host}
                    onChange={(event) => setCredentialForm({ ...credentialForm, host: event.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
                    placeholder="127.0.0.1"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Port</span>
                  <input
                    value={credentialForm.port}
                    onChange={(event) => setCredentialForm({ ...credentialForm, port: event.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
                    placeholder={credentialForm.type === 'db_redis_readonly' ? '6379' : '3306'}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Username</span>
                  <input
                    value={credentialForm.username}
                    onChange={(event) => setCredentialForm({ ...credentialForm, username: event.target.value })}
                    required={credentialForm.type === 'db_mysql_readonly'}
                    className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Password</span>
                  <input
                    type="password"
                    value={credentialForm.password}
                    onChange={(event) => setCredentialForm({ ...credentialForm, password: event.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Database</span>
                  <input
                    value={credentialForm.database}
                    onChange={(event) => setCredentialForm({ ...credentialForm, database: event.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder={credentialForm.type === 'db_redis_readonly' ? '0' : 'app'}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">SSL Mode</span>
                  <input
                    value={credentialForm.sslMode}
                    onChange={(event) => setCredentialForm({ ...credentialForm, sslMode: event.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="preferred"
                  />
                </label>
              </>
            )}
            <div className="flex items-end justify-end gap-2 lg:col-span-4">
              <button
                type="button"
                onClick={() => setShowCredentialForm(false)}
                className="px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={savingCredential}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {savingCredential ? '保存中...' : '保存凭据'}
              </button>
            </div>
          </form>
        )}

        {cloudCredentials.length === 0 ? (
          <div className="text-sm text-muted-foreground border rounded-md p-3">
            暂无操作凭据
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {cloudCredentials.map((credential) => (
              <div key={credential.id} className="border rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">{credential.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {credentialTypeLabel(credential.type)} · {formatDate(credential.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteCloudCredential(credential)}
                    disabled={deletingCredential === credential.id}
                    className="px-2.5 py-1 text-xs rounded-md border hover:bg-accent disabled:opacity-50"
                  >
                    {deletingCredential === credential.id ? '删除中...' : '删除'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {bindingResource && (
        <section className="border rounded-lg p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">资源绑定</h2>
              <div className="text-sm text-muted-foreground mt-1">
                {bindingResource.name} · {providerLabels[bindingResource.provider] || bindingResource.provider}
              </div>
            </div>
            <button
              onClick={() => setBindingResource(null)}
              className="px-2.5 py-1 text-xs rounded-md border hover:bg-accent"
            >
              关闭
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">环境</span>
              <select
                value={bindingForm.environmentId}
                onChange={(event) => setBindingForm({ ...bindingForm, environmentId: event.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">不绑定环境</option>
                {environments.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.project?.name ? `${environment.project.name} / ` : ''}{environment.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">服务器</span>
              <select
                value={bindingForm.serverId}
                onChange={(event) => setBindingForm({ ...bindingForm, serverId: event.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">不绑定服务器</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name} ({server.host})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">凭据</span>
              <select
                value={bindingForm.credentialId}
                onChange={(event) => setBindingForm({ ...bindingForm, credentialId: event.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">不绑定凭据</option>
                {bindingCredentialOptions.map((credential) => (
                  <option key={credential.id} value={credential.id}>
                    {credential.name} ({credential.type})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">查询凭据</span>
              <select
                value={bindingForm.queryCredentialId}
                onChange={(event) => setBindingForm({ ...bindingForm, queryCredentialId: event.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">不绑定查询凭据</option>
                {bindingQueryCredentialOptions.map((credential) => (
                  <option key={credential.id} value={credential.id}>
                    {credential.name} ({credential.type})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setBindingResource(null)}
              className="px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
            >
              取消
            </button>
            <button
              onClick={saveResourceBinding}
              disabled={savingBinding}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {savingBinding ? '保存中...' : '保存绑定'}
            </button>
          </div>
        </section>
      )}

      {queryResource && (
        <section className="border rounded-lg p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">只读查询</h2>
              <div className="text-sm text-muted-foreground mt-1">
                {queryResource.name} · {kindLabels[queryResource.kind] || queryResource.kind}
              </div>
            </div>
            <button
              onClick={() => setQueryResource(null)}
              className="px-2.5 py-1 text-xs rounded-md border hover:bg-accent"
            >
              关闭
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-[220px_1fr_140px]">
            <label className="space-y-1 text-sm">
              <span className="font-medium">类型</span>
              <select
                value={queryForm.queryType}
                onChange={(event) => {
                  const queryType = event.target.value;
                  setQueryForm({
                    ...queryForm,
                    queryType,
                    query: defaultQueryText(queryResource, queryType),
                  });
                }}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                {allowedQueryTypes(queryResource).map((queryType) => (
                  <option key={queryType} value={queryType}>
                    {queryTypeLabels[queryType] || queryType}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">查询</span>
              <textarea
                value={queryForm.query}
                onChange={(event) => setQueryForm({ ...queryForm, query: event.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Limit</span>
              <input
                type="number"
                min={1}
                max={1000}
                value={queryForm.limit}
                onChange={(event) => setQueryForm({ ...queryForm, limit: Number(event.target.value) })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
            </label>
          </div>
          {supportsDirectDbLiveQuery(queryResource) && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">真实只读查询：</span>
              {' '}
              {canRunLiveQuery(queryResource)
                ? `${queryCredentialLabel(queryResource, credentials)}，执行前会再次确认并只允许只读命令`
                : '需要先在资源绑定中选择 MySQL/Redis 只读查询凭据'}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setQueryResource(null)}
              className="px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
            >
              取消
            </button>
            <button
              onClick={runResourceQueryPlan}
              disabled={queryingResource === queryResource.id}
              className="px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent disabled:opacity-50"
            >
              {queryingResource === queryResource.id ? '生成中...' : '生成计划'}
            </button>
            {supportsDirectDbLiveQuery(queryResource) && (
              <button
                onClick={runResourceQueryLive}
                disabled={queryingResource === queryResource.id || !canRunLiveQuery(queryResource)}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {queryingResource === queryResource.id ? '执行中...' : '执行只读查询'}
              </button>
            )}
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="border rounded-lg p-4 space-y-4">
          <div>
            <h2 className="font-semibold">服务器 Docker 同步</h2>
            <p className="text-sm text-muted-foreground mt-1">
              从服务器维度盘点容器以及 Docker 部署的 MySQL、Redis 等资源；当前环境：{getEnvironmentLabel(environments, selectedEnvironmentId)}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedServerId}
              onChange={(event) => setSelectedServerId(event.target.value)}
              className="flex-1 px-3 py-2 border rounded-md bg-background"
            >
              {servers.length === 0 ? (
                <option value="">暂无服务器</option>
              ) : (
                servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name} ({server.host})
                  </option>
                ))
              )}
            </select>
            <button
              onClick={syncServerDocker}
              disabled={!selectedServerId || syncing?.startsWith('server:')}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {syncing?.startsWith('server:') ? '同步中...' : '同步 Docker'}
            </button>
          </div>
        </section>

        <section className="border rounded-lg p-4 space-y-4">
          <div>
            <h2 className="font-semibold">云资源同步</h2>
            <p className="text-sm text-muted-foreground mt-1">
              将 RDS、SLS、腾讯云 COS 纳入同一资源清单；当前环境：{getEnvironmentLabel(environments, selectedEnvironmentId)}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={cloudProvider}
              onChange={(event) => {
                setCloudProvider(event.target.value as typeof cloudProvider);
                setSelectedCloudCredentialId('');
              }}
              className="flex-1 px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">全部云资源</option>
              <option value="aliyun-rds">阿里云 RDS</option>
              <option value="aliyun-sls">阿里云 SLS</option>
              <option value="tencent-cos">腾讯云 COS</option>
            </select>
            <select
              value={selectedCloudCredentialId}
              onChange={(event) => setSelectedCloudCredentialId(event.target.value)}
              className="flex-1 px-3 py-2 border rounded-md bg-background"
            >
              <option value="">不指定凭据</option>
              {cloudSyncCredentials.map((credential) => (
                <option key={credential.id} value={credential.id}>
                  {credential.name} ({credential.type})
                </option>
              ))}
            </select>
            <button
              onClick={syncCloud}
              disabled={syncing?.startsWith('cloud:')}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {syncing?.startsWith('cloud:') ? '同步中...' : '同步云资源'}
            </button>
          </div>
        </section>
      </div>

      <section className="border rounded-lg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">云 Provider 健康</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              汇总最近云同步中的 live/fallback、quota、rate limit、timeout 和 provider 失败信号
            </p>
          </div>
          <span className="text-xs text-muted-foreground">最近 100 条可见云同步</span>
        </div>
        {cloudProviderHealth.length === 0 ? (
          <div className="mt-4 rounded-md border px-3 py-4 text-sm text-muted-foreground">
            暂无可见云 provider 健康数据
          </div>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            {cloudProviderHealth.map((summary) => (
              <CloudProviderHealthCard key={summary.provider} summary={summary} />
            ))}
          </div>
        )}
      </section>

      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold">资源清单</h2>
            <p className="text-sm text-muted-foreground mt-1">
              同步模式：{capabilities?.syncMode || 'inventory_only'} · 执行模式：{capabilities?.executionMode || 'server_executor_first'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={filterSource}
              onChange={(event) => setFilterSource(event.target.value)}
              className="px-3 py-2 border rounded-md bg-background text-sm"
            >
              <option value="all">全部来源</option>
              <option value="server">服务器</option>
              <option value="cloud">云资源</option>
            </select>
            <select
              value={filterProvider}
              onChange={(event) => setFilterProvider(event.target.value)}
              className="px-3 py-2 border rounded-md bg-background text-sm"
            >
              <option value="all">全部 Provider</option>
              <option value="docker">Docker</option>
              <option value="aliyun-rds">阿里云 RDS</option>
              <option value="aliyun-sls">阿里云 SLS</option>
              <option value="tencent-cos">腾讯云 COS</option>
            </select>
          </div>
        </div>

        {filteredResources.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-md">
            暂无资源，先同步服务器或云资源
          </div>
        ) : (
          <div className="space-y-5">
            {serverGroups.some((group) => group.resources.length > 0) && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">服务器维度</h3>
                <div className="grid gap-3">
                  {serverGroups
                    .filter((group) => group.resources.length > 0)
                    .map((group) => (
                      <div key={group.server.id} className="border rounded-md p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{group.server.name}</div>
                            <div className="text-xs text-muted-foreground">{group.server.host}</div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {group.resources.length} 个资源
                          </span>
                        </div>
                        <ResourceRows
                          resources={group.resources}
                          latestMetricByResourceId={latestMetricByResourceId}
                          metricTrendByResourceId={metricTrendByResourceId}
                          getActions={getResourceActions}
                          onViewDetails={(resource) => setSelectedResourceId(resource.id)}
                          onEditBinding={openBindingPanel}
                          onProbeConnection={probeResourceConnection}
                          onRunQuery={openQueryComposer}
                          onRunAction={runResourceActionPlan}
                          onRunLiveAction={runResourceActionLive}
                          runningAction={runningAction}
                          probingResource={probingResource}
                          queryingResource={queryingResource}
                          queueActions={queueResourceActions}
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {cloudResources.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">云资源</h3>
                <div className="border rounded-md p-3">
                  <ResourceRows
                    resources={cloudResources}
                    latestMetricByResourceId={latestMetricByResourceId}
                    metricTrendByResourceId={metricTrendByResourceId}
                    getActions={getResourceActions}
                    onViewDetails={(resource) => setSelectedResourceId(resource.id)}
                    onEditBinding={openBindingPanel}
                    onProbeConnection={probeResourceConnection}
                    onRunQuery={openQueryComposer}
                    onRunAction={runResourceActionPlan}
                    onRunLiveAction={runResourceActionLive}
                    runningAction={runningAction}
                    probingResource={probingResource}
                    queryingResource={queryingResource}
                    queueActions={queueResourceActions}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="border rounded-lg p-4">
          <h2 className="font-semibold">最近同步</h2>
          {syncRuns.length === 0 ? (
            <div className="text-sm text-muted-foreground mt-4">暂无同步记录</div>
          ) : (
            <div className="mt-4 space-y-3">
              {syncRuns.slice(0, 6).map((run) => {
                const diagnostics = getCloudSyncProviderDiagnostics(run);
                return (
                  <div key={run.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {providerLabels[run.provider] || run.provider}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {run.server?.name || run.credential?.name || run.scope || run.sourceType}
                        {' · '}
                        {formatDate(run.startedAt)}
                      </div>
                      {diagnostics.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {diagnostics.map((diagnostic) => (
                            <CloudSyncProviderDiagnosticRow
                              key={`${run.id}-${diagnostic.provider}`}
                              diagnostic={diagnostic}
                            />
                          ))}
                        </div>
                      )}
                      {run.error && <div className="text-xs text-destructive mt-1">{run.error}</div>}
                    </div>
                    <div className="shrink-0 text-right">
                      {getStatusBadge(run.status)}
                      <div className="text-xs text-muted-foreground mt-1">{run.discovered} 个</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="border rounded-lg p-4">
          <h2 className="font-semibold">最近连接探测</h2>
          {connectionRuns.length === 0 ? (
            <div className="text-sm text-muted-foreground mt-4">暂无连接探测记录</div>
          ) : (
            <div className="mt-4 space-y-3">
              {connectionRuns.slice(0, 6).map((run) => (
                <div key={run.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-b-0">
                  <div>
                    <div className="text-sm font-medium">
                      {run.resource?.name || providerLabels[run.provider] || run.provider}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {run.authAdapterKey}
                      {' · '}
                      {run.executorKey}/{run.adapterKey}
                      {' · '}
                      {run.dryRun ? 'dry run' : 'live'}
                      {' · '}
                      {formatDate(run.startedAt)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {run.targetEndpoint || run.resource?.endpoint || kindLabels[run.kind] || run.kind}
                    </div>
                    {run.error && <div className="text-xs text-destructive mt-1">{run.error}</div>}
                  </div>
                  <div className="text-right">
                    {getStatusBadge(run.status)}
                    <div className="text-xs text-muted-foreground mt-1">
                      {providerLabels[run.provider] || run.provider}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border rounded-lg p-4">
          <h2 className="font-semibold">最近只读查询</h2>
          {queryRuns.length === 0 ? (
            <div className="text-sm text-muted-foreground mt-4">暂无只读查询记录</div>
          ) : (
            <div className="mt-4 space-y-3">
              {queryRuns.slice(0, 6).map((run) => (
                <div key={run.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-b-0">
                  <div>
                    <div className="text-sm font-medium">
                      {run.resource?.name || providerLabels[run.provider] || run.provider}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {queryTypeLabels[run.queryType] || run.queryType}
                      {' · '}
                      {run.authAdapterKey}
                      {' · '}
                      {run.executorKey}/{run.adapterKey}
                      {' · '}
                      {run.dryRun ? 'dry run' : 'live'}
                      {' · '}
                      {formatDate(run.startedAt)}
                    </div>
                    {run.query && (
                      <pre className="mt-1 max-w-full truncate font-mono text-xs text-muted-foreground">
                        {run.query}
                      </pre>
                    )}
                    {run.error && <div className="text-xs text-destructive mt-1">{run.error}</div>}
                    <QueryPreview result={run.result} />
                  </div>
                  <div className="text-right">
                    {getStatusBadge(run.status)}
                    <div className="text-xs text-muted-foreground mt-1">
                      {providerLabels[run.provider] || run.provider}
                    </div>
                    {run.result?.adapterState?.current && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {run.result.adapterState.current}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border rounded-lg p-4">
          <h2 className="font-semibold">最近动作</h2>
          {actionRuns.length === 0 ? (
            <div className="text-sm text-muted-foreground mt-4">暂无动作记录</div>
          ) : (
            <div className="mt-4 space-y-3">
              {actionRuns.slice(0, 6).map((run) => (
                <div key={run.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-b-0">
                  <div>
                    <div className="text-sm font-medium">{actionLabels[run.action] || run.action}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {run.resource?.name || '-'}
                      {' · '}
                      {run.dryRun ? 'dry run' : 'live'}
                      {' · '}
                      {formatDate(run.startedAt)}
                    </div>
                    {run.serverExecutionJob && (
                      <div className="mt-1 text-xs">
                        <Link href="/execution-governance" className="text-primary hover:underline">
                          Job {run.serverExecutionJob.id.slice(0, 8)} · {getStatusText(run.serverExecutionJob.status)}
                        </Link>
                      </div>
                    )}
                    {run.error && <div className="text-xs text-destructive mt-1">{run.error}</div>}
                  </div>
                  <div className="text-right">
                    {getStatusBadge(run.status)}
                    <div className="text-xs text-muted-foreground mt-1">{run.executorKey}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border rounded-lg p-4">
          <h2 className="font-semibold">可复用生态</h2>
          <div className="mt-4 grid gap-2">
            {(capabilities?.reusableSvtonResources || []).map((item) => (
              <div key={item} className="px-3 py-2 rounded-md bg-muted text-sm">
                {item}
              </div>
            ))}
          </div>
          {capabilities?.safetyNotes && (
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              {capabilities.safetyNotes.map((note) => (
                <div key={note}>{note}</div>
              ))}
            </div>
          )}
        </section>

        <section className="border rounded-lg p-4">
          <h2 className="font-semibold">执行器 Adapter</h2>
          <div className="mt-4 space-y-3">
            {(capabilities?.executorAdapters || []).map((adapter) => (
              <div key={adapter.key} className="rounded-md bg-muted p-3 text-sm">
                <div className="font-medium">{adapter.key}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  当前：{adapter.currentAdapter || adapter.currentTransport} · 后续：{adapter.futureTransport}
                </div>
              </div>
            ))}
          </div>
          {capabilities?.credentialAuthAdapters && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-medium">Credential/Auth Adapter</h3>
              <div className="mt-3 space-y-2">
                {capabilities.credentialAuthAdapters.map((adapter) => (
                  <div key={adapter.key} className="rounded-md bg-muted p-3 text-sm">
                    <div className="font-medium">{adapter.key}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      来源：{adapter.source} · 当前：{adapter.currentStatus} · 后续：{adapter.futureTransport}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {capabilities?.queryAdapters && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-medium">Query Adapter</h3>
              <div className="mt-3 space-y-2">
                {capabilities.queryAdapters.map((adapter) => (
                  <div key={adapter.key} className="rounded-md bg-muted p-3 text-sm">
                    <div className="font-medium">{adapter.key}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      来源：{adapter.sourceTypes.join('/')} · 当前：{adapter.currentStatus} · 后续：{adapter.futureTransport}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {selectedResource && (
        <ResourceDetailDrawer
          resource={selectedResource}
          actionRuns={selectedResourceActionRuns}
          metricSnapshots={selectedResourceMetricSnapshots}
          metricTrend={selectedResourceMetricTrend}
          metricSeries={selectedResourceMetricSeries}
          metricSeriesMetric={metricSeriesMetric}
          metricSeriesWindowMinutes={metricSeriesWindowMinutes}
          loadingMetricSeries={loadingMetricSeries}
          connectionRuns={selectedResourceConnectionRuns}
          queryRuns={selectedResourceQueryRuns}
          credentials={credentials}
          getActions={getResourceActions}
          onClose={() => setSelectedResourceId(null)}
          onEditBinding={(resource) => {
            setSelectedResourceId(null);
            openBindingPanel(resource);
          }}
          onProbeConnection={probeResourceConnection}
          onRunQuery={(resource) => {
            setSelectedResourceId(null);
            openQueryComposer(resource);
          }}
          onRunAction={runResourceActionPlan}
          onRunLiveAction={runResourceActionLive}
          runningAction={runningAction}
          probingResource={probingResource}
          queryingResource={queryingResource}
          queueActions={queueResourceActions}
          onMetricSeriesMetricChange={setMetricSeriesMetric}
          onMetricSeriesWindowChange={setMetricSeriesWindowMinutes}
        />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function ResourceRows({
  resources,
  latestMetricByResourceId,
  metricTrendByResourceId,
  getActions,
  onViewDetails,
  onEditBinding,
  onProbeConnection,
  onRunQuery,
  onRunAction,
  onRunLiveAction,
  runningAction,
  probingResource,
  queryingResource,
  queueActions,
}: {
  resources: ManagedResource[];
  latestMetricByResourceId: Map<string, ResourceMetricSnapshot>;
  metricTrendByResourceId: Map<string, ResourceMetricTrendSummary>;
  getActions: (resource: ManagedResource) => ResourceActionDefinition[];
  onViewDetails: (resource: ManagedResource) => void;
  onEditBinding: (resource: ManagedResource) => void;
  onProbeConnection: (resource: ManagedResource) => void;
  onRunQuery: (resource: ManagedResource) => void;
  onRunAction: (resource: ManagedResource, action: ResourceActionDefinition) => void;
  onRunLiveAction: (resource: ManagedResource, action: ResourceActionDefinition) => void;
  runningAction: string | null;
  probingResource: string | null;
  queryingResource: string | null;
  queueActions: boolean;
}) {
  return (
    <div className="mt-3 divide-y">
      {resources.map((resource) => {
        const resourceActions = getActions(resource);
        const latestMetric = latestMetricByResourceId.get(resource.id);
        const metricTrend = metricTrendByResourceId.get(resource.id);
        const latestCpuPercent = metricTrend?.cpuPercent.latest ?? latestMetric?.cpuPercent;
        const latestMemoryPercent = metricTrend?.memoryPercent.latest ?? latestMetric?.memoryPercent;
        const cpuDeltaLabel = metricTrend ? formatSignedPercentDelta(metricTrend.cpuPercent.delta) : '';
        const memoryDeltaLabel = metricTrend ? formatSignedPercentDelta(metricTrend.memoryPercent.delta) : '';
        return (
          <div key={resource.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{resource.name}</span>
                  {getStatusBadge(resource.status)}
                  <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                    {kindLabels[resource.kind] || resource.kind}
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                    {providerLabels[resource.provider] || resource.provider}
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                    {resource.environment?.name || '未绑定环境'}
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                    {resource.credential?.name || '未绑定凭据'}
                  </span>
                  {queryCredentialIdOf(resource) && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                      已绑定查询凭据
                    </span>
                  )}
                  {(metricTrend || latestMetric) && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                      CPU {formatPercent(latestCpuPercent)}
                      {cpuDeltaLabel ? ` ${cpuDeltaLabel}` : ''}
                    </span>
                  )}
                  {(metricTrend || latestMetric) && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                      Mem {formatPercent(latestMemoryPercent)}
                      {memoryDeltaLabel ? ` ${memoryDeltaLabel}` : ''}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {resource.endpoint || resource.externalId}
                </div>
                {resource.project && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {resource.project.name}
                  </div>
                )}
              </div>
              <div className="space-y-2 lg:text-right">
                <div className="text-xs text-muted-foreground">
                  {resource.lastSyncAt ? `同步于 ${formatDate(resource.lastSyncAt)}` : '未同步'}
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button
                    onClick={() => onViewDetails(resource)}
                    className="px-2.5 py-1 text-xs rounded-md border hover:bg-accent"
                    title="查看资源详情和最近操作历史"
                  >
                    详情
                  </button>
                  <button
                    onClick={() => onEditBinding(resource)}
                    className="px-2.5 py-1 text-xs rounded-md border hover:bg-accent"
                    title="调整资源环境、服务器和凭据绑定"
                  >
                    绑定
                  </button>
                  <button
                    onClick={() => onProbeConnection(resource)}
                    disabled={probingResource === resource.id}
                    className="px-2.5 py-1 text-xs rounded-md border hover:bg-accent disabled:opacity-50"
                    title="生成 Credential/Auth 与 Executor 连接探测计划"
                  >
                    {probingResource === resource.id ? '探测中...' : '连接探测'}
                  </button>
                  <button
                    onClick={() => onRunQuery(resource)}
                    disabled={queryingResource === resource.id}
                    className="px-2.5 py-1 text-xs rounded-md border hover:bg-accent disabled:opacity-50"
                    title="生成只读查询/浏览计划"
                  >
                    {queryingResource === resource.id ? '生成中...' : '只读查询'}
                  </button>
                  {resourceActions.slice(0, 3).map((action) => {
                    const isRunning = runningAction === `${resource.id}:${action.key}`;
                    const isRequestingLive = runningAction === `${resource.id}:${action.key}:live`;
                    const canRunLive = canRunLiveAction(resource, action);
                    const planLabel = queueActions ? '计划入队' : action.name;
                    const pendingPlanLabel = queueActions ? '入队中...' : '生成中...';
                    const liveLabel = queueActions
                      ? (action.mode === 'read' ? 'Live 入队' : '申请入队')
                      : (action.mode === 'read' ? '执行 Live' : '申请 Live');
                    const pendingLiveLabel = queueActions
                      ? '入队中...'
                      : (action.mode === 'read' ? '执行中...' : '申请中...');
                    return (
                      <div key={action.key} className="flex gap-1">
                        <button
                          onClick={() => onRunAction(resource, action)}
                          disabled={isRunning}
                          className="px-2.5 py-1 text-xs rounded-md border hover:bg-accent disabled:opacity-50"
                          title={action.description}
                        >
                          {isRunning ? pendingPlanLabel : planLabel}
                        </button>
                        {canRunLive && (
                          <button
                            onClick={() => onRunLiveAction(resource, action)}
                            disabled={isRequestingLive}
                            className="px-2.5 py-1 text-xs rounded-md border hover:bg-accent disabled:opacity-50"
                            title={queueActions
                              ? '通过 Server executor 队列治理执行资源动作'
                              : (action.mode === 'read' ? '通过 Server executor 执行 live 只读动作' : '申请 live 执行审批')}
                          >
                            {isRequestingLive ? pendingLiveLabel : liveLabel}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResourceDetailDrawer({
  resource,
  actionRuns,
  metricSnapshots,
  metricTrend,
  metricSeries,
  metricSeriesMetric,
  metricSeriesWindowMinutes,
  loadingMetricSeries,
  connectionRuns,
  queryRuns,
  credentials,
  getActions,
  onClose,
  onEditBinding,
  onProbeConnection,
  onRunQuery,
  onRunAction,
  onRunLiveAction,
  runningAction,
  probingResource,
  queryingResource,
  queueActions,
  onMetricSeriesMetricChange,
  onMetricSeriesWindowChange,
}: {
  resource: ManagedResource;
  actionRuns: ResourceActionRun[];
  metricSnapshots: ResourceMetricSnapshot[];
  metricTrend: ResourceMetricTrendSummary | null;
  metricSeries: ResourceMetricSeries | null;
  metricSeriesMetric: ResourceMetricSeriesMetric;
  metricSeriesWindowMinutes: string;
  loadingMetricSeries: boolean;
  connectionRuns: ResourceConnectionRun[];
  queryRuns: ResourceQueryRun[];
  credentials: TeamCredential[];
  getActions: (resource: ManagedResource) => ResourceActionDefinition[];
  onClose: () => void;
  onEditBinding: (resource: ManagedResource) => void;
  onProbeConnection: (resource: ManagedResource) => void;
  onRunQuery: (resource: ManagedResource) => void;
  onRunAction: (resource: ManagedResource, action: ResourceActionDefinition) => void;
  onRunLiveAction: (resource: ManagedResource, action: ResourceActionDefinition) => void;
  runningAction: string | null;
  probingResource: string | null;
  queryingResource: string | null;
  queueActions: boolean;
  onMetricSeriesMetricChange: (metric: ResourceMetricSeriesMetric) => void;
  onMetricSeriesWindowChange: (windowMinutes: string) => void;
}) {
  const resourceActions = getActions(resource);

  return (
    <div className="fixed inset-0 z-50 bg-black/30" role="dialog" aria-modal="true" aria-label="资源详情">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
        aria-label="关闭资源详情"
      />
      <aside className="relative ml-auto flex h-full w-full max-w-4xl flex-col bg-background shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{resource.name}</h2>
              {getStatusBadge(resource.status)}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {kindLabels[resource.kind] || resource.kind}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {providerLabels[resource.provider] || resource.provider}
              </span>
            </div>
            <div className="mt-1 truncate text-sm text-muted-foreground">
              {resource.endpoint || resource.externalId || resource.id}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
          >
            关闭
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <section className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ResourceFact label="来源" value={sourceTypeLabel(resource.sourceType)} />
              <ResourceFact label="项目" value={resource.project?.name || '未绑定项目'} />
              <ResourceFact label="环境" value={resource.environment?.name || '未绑定环境'} />
              <ResourceFact label="服务器" value={resource.server ? `${resource.server.name} (${resource.server.host})` : '未绑定服务器'} />
              <ResourceFact label="操作凭据" value={resource.credential?.name || '未绑定凭据'} />
              <ResourceFact label="查询凭据" value={queryCredentialLabel(resource, credentials)} />
              <ResourceFact label="外部 ID" value={resource.externalId || '-'} mono />
              <ResourceFact label="最近同步" value={resource.lastSyncAt ? formatDate(resource.lastSyncAt) : '未同步'} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onEditBinding(resource)}
                className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
              >
                绑定
              </button>
              <button
                onClick={() => onProbeConnection(resource)}
                disabled={probingResource === resource.id}
                className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {probingResource === resource.id ? '探测中...' : '连接探测'}
              </button>
              <button
                onClick={() => onRunQuery(resource)}
                disabled={queryingResource === resource.id}
                className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {queryingResource === resource.id ? '生成中...' : '只读查询'}
              </button>
              {resourceActions.map((action) => {
                const isRunning = runningAction === `${resource.id}:${action.key}`;
                const isRequestingLive = runningAction === `${resource.id}:${action.key}:live`;
                const canRunLive = canRunLiveAction(resource, action);
                const planLabel = queueActions ? `${action.name}入队` : action.name;
                const pendingPlanLabel = queueActions ? '入队中...' : '生成中...';
                const liveLabel = queueActions
                  ? (action.mode === 'read' ? 'Live 入队' : '申请入队')
                  : (action.mode === 'read' ? '执行 Live' : '申请 Live');
                const pendingLiveLabel = queueActions
                  ? '入队中...'
                  : (action.mode === 'read' ? '执行中...' : '申请中...');
                return (
                  <div key={action.key} className="flex gap-1">
                    <button
                      onClick={() => onRunAction(resource, action)}
                      disabled={isRunning}
                      className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                      title={action.description}
                    >
                      {isRunning ? pendingPlanLabel : planLabel}
                    </button>
                    {canRunLive && (
                      <button
                        onClick={() => onRunLiveAction(resource, action)}
                        disabled={isRequestingLive}
                        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                      >
                        {isRequestingLive ? pendingLiveLabel : liveLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-5 grid gap-4 xl:grid-cols-2">
            <JsonPanel title="配置" value={resource.config} />
            <JsonPanel title="元数据" value={resource.metadata} />
          </section>

          <section className="mt-5 space-y-5">
            <MetricSeriesPanel
              series={metricSeries}
              metric={metricSeriesMetric}
              windowMinutes={metricSeriesWindowMinutes}
              loading={loadingMetricSeries}
              onMetricChange={onMetricSeriesMetricChange}
              onWindowChange={onMetricSeriesWindowChange}
            />

            {metricTrend && <MetricTrendPanel trend={metricTrend} />}

            <HistorySection title="指标快照" emptyText="暂无指标快照" count={metricSnapshots.length}>
              {metricSnapshots.slice(0, 8).map((snapshot) => (
                <MetricSnapshotItem key={snapshot.id} snapshot={snapshot} />
              ))}
            </HistorySection>

            <HistorySection title="动作历史" emptyText="暂无动作记录" count={actionRuns.length}>
              {actionRuns.slice(0, 8).map((run) => (
                <ActionRunItem key={run.id} run={run} />
              ))}
            </HistorySection>

            <HistorySection title="连接探测" emptyText="暂无连接探测记录" count={connectionRuns.length}>
              {connectionRuns.slice(0, 8).map((run) => (
                <ConnectionRunItem key={run.id} run={run} />
              ))}
            </HistorySection>

            <HistorySection title="只读查询" emptyText="暂无只读查询记录" count={queryRuns.length}>
              {queryRuns.slice(0, 8).map((run) => (
                <QueryRunItem key={run.id} run={run} />
              ))}
            </HistorySection>
          </section>
        </div>
      </aside>
    </div>
  );
}

function ResourceFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 min-w-0 truncate text-sm font-medium ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value?: Record<string, unknown> | null }) {
  const formatted = formatJsonValue(value);

  return (
    <div className="rounded-md border">
      <div className="border-b px-3 py-2 text-sm font-medium">{title}</div>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-xs text-muted-foreground">
        {formatted}
      </pre>
    </div>
  );
}

function CloudProviderHealthCard({ summary }: { summary: CloudProviderHealthSummary }) {
  const requestPolicy = formatCloudSyncRequestPolicy(summary.lastRequestPolicy);
  const issue = summary.recentIssues[0];

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {providerLabels[summary.provider] || summary.provider}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {summary.lastRunAt ? `最近同步 ${formatDate(summary.lastRunAt)}` : '暂无同步'}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${cloudProviderHealthStatusClass(summary.status)}`}>
          {cloudProviderHealthStatusLabel(summary.status)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <HealthMetric label="runs" value={summary.totalRuns} />
        <HealthMetric label="live" value={summary.liveRuns} />
        <HealthMetric label="fallback" value={summary.fallbackRuns} />
        <HealthMetric label="quota" value={summary.quotaSignals} tone={summary.quotaSignals > 0 ? 'warn' : 'muted'} />
        <HealthMetric label="rate" value={summary.rateLimitSignals} tone={summary.rateLimitSignals > 0 ? 'warn' : 'muted'} />
        <HealthMetric label="timeout" value={summary.timeoutSignals} tone={summary.timeoutSignals > 0 ? 'warn' : 'muted'} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>provider failures {summary.providerFailureCount}</span>
        <span>config fallback {summary.configFallbackCount}</span>
        <span>发现 {summary.discovered}</span>
        {summary.sdk && <span className="break-all">sdk {summary.sdk}</span>}
      </div>
      {summary.regions.length > 0 && (
        <div className="mt-2 break-all text-xs text-muted-foreground">
          regions {summary.regions.join(', ')}
        </div>
      )}
      {requestPolicy && (
        <div className="mt-2 break-all text-xs text-muted-foreground">
          {requestPolicy}
        </div>
      )}
      {(summary.lastError || issue) && (
        <div className={`mt-2 break-words text-xs ${summary.status === 'error' ? 'text-destructive' : 'text-yellow-700'}`}>
          {issue?.message || summary.lastError}
        </div>
      )}
    </div>
  );
}

function HealthMetric({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: number;
  tone?: 'muted' | 'warn';
}) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1">
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-semibold ${tone === 'warn' ? 'text-yellow-700' : ''}`}>{value}</div>
    </div>
  );
}

function CloudSyncProviderDiagnosticRow({ diagnostic }: { diagnostic: CloudSyncProviderDiagnostic }) {
  const requestPolicy = formatCloudSyncRequestPolicy(diagnostic.requestPolicy);
  const modeClass = diagnostic.live ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
  const modeLabel = diagnostic.live ? 'live SDK' : 'fallback';

  return (
    <div className={`border-l-2 pl-2 ${diagnostic.live ? 'border-green-300' : 'border-yellow-300'}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-foreground">
          {providerLabels[diagnostic.provider] || diagnostic.provider}
        </span>
        <span className={`rounded-full px-2 py-0.5 ${modeClass}`}>{modeLabel}</span>
        {diagnostic.syncMode && (
          <span className="font-mono text-muted-foreground">{diagnostic.syncMode}</span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>解析 {formatOptionalNumber(diagnostic.parsedCount)}</span>
        <span>跳过 {formatOptionalNumber(diagnostic.skippedCount)}</span>
        {diagnostic.regions.length > 0 && (
          <span className="break-all">regions {diagnostic.regions.join(', ')}</span>
        )}
        {diagnostic.sdk && <span className="break-all">sdk {diagnostic.sdk}</span>}
        {requestPolicy && <span className="break-all">{requestPolicy}</span>}
      </div>
      {diagnostic.fallbackReason && (
        <div className="mt-1 break-words text-xs text-yellow-700">
          fallback: {diagnostic.fallbackReason}
        </div>
      )}
      {diagnostic.errors.slice(0, 2).map((error, index) => (
        <div key={`${diagnostic.provider}-error-${index}`} className="mt-1 break-words text-xs text-destructive">
          {error}
        </div>
      ))}
    </div>
  );
}

const metricSeriesMetricOptions: Array<{ value: ResourceMetricSeriesMetric; label: string }> = [
  { value: 'cpuPercent', label: 'CPU' },
  { value: 'memoryPercent', label: '内存占比' },
  { value: 'memoryUsageBytes', label: '内存用量' },
  { value: 'networkInputBytes', label: '网络入' },
  { value: 'networkOutputBytes', label: '网络出' },
  { value: 'blockInputBytes', label: '块读' },
  { value: 'blockOutputBytes', label: '块写' },
  { value: 'pids', label: 'PIDs' },
];

const metricSeriesWindowOptions = [
  { value: '60', label: '1 小时' },
  { value: '360', label: '6 小时' },
  { value: '1440', label: '24 小时' },
  { value: '10080', label: '7 天' },
];

function MetricSeriesPanel({
  series,
  metric,
  windowMinutes,
  loading,
  onMetricChange,
  onWindowChange,
}: {
  series: ResourceMetricSeries | null;
  metric: ResourceMetricSeriesMetric;
  windowMinutes: string;
  loading: boolean;
  onMetricChange: (metric: ResourceMetricSeriesMetric) => void;
  onWindowChange: (windowMinutes: string) => void;
}) {
  const summary = series?.summary;

  return (
    <div className="border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">指标曲线</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {series ? `${metricSourceLabel(series.metricSource)} · ${series.sampleCount} 个样本` : '暂无样本'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="指标"
            value={metric}
            onChange={(event) => onMetricChange(event.target.value as ResourceMetricSeriesMetric)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            {metricSeriesMetricOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            aria-label="时间窗口"
            value={windowMinutes}
            onChange={(event) => onWindowChange(event.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            {metricSeriesWindowOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 rounded-md border px-3 py-3">
        {loading ? (
          <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">加载中...</div>
        ) : series && series.points.length > 0 ? (
          <MetricLineChart series={series} metric={metric} />
        ) : (
          <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">暂无指标曲线</div>
        )}
      </div>

      {summary && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTrendValue label="当前" value={formatMetricSeriesValue(metric, summary.latest)} detail={`更新 ${series ? formatDate(series.lastSampledAt) : '-'}`} />
          <MetricTrendValue label="平均" value={formatMetricSeriesValue(metric, summary.average)} detail={`窗口 ${formatMetricWindow(series?.windowMinutes || Number(windowMinutes))}`} />
          <MetricTrendValue label="峰值" value={formatMetricSeriesValue(metric, summary.max)} detail="max" />
          <MetricTrendValue label="变化" value={formatMetricSeriesDelta(metric, summary.delta) || '-'} detail="latest - oldest" />
        </div>
      )}
    </div>
  );
}

function MetricLineChart({ series, metric }: { series: ResourceMetricSeries; metric: ResourceMetricSeriesMetric }) {
  const validPoints = series.points.filter((point) => (
    typeof point.value === 'number' && Number.isFinite(point.value)
  )) as Array<ResourceMetricSeriesPoint & { value: number }>;

  if (validPoints.length === 0) {
    return <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">暂无有效样本</div>;
  }

  const viewBoxWidth = 640;
  const viewBoxHeight = 170;
  const padding = { left: 44, right: 12, top: 14, bottom: 30 };
  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const chartHeight = viewBoxHeight - padding.top - padding.bottom;
  const values = validPoints.map((point) => point.value);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(...values, 1);
  const range = maxValue === minValue ? 1 : maxValue - minValue;
  const chartPoints = validPoints.map((point, index) => {
    const x = padding.left + (validPoints.length === 1 ? chartWidth / 2 : (index / (validPoints.length - 1)) * chartWidth);
    const y = padding.top + ((maxValue - point.value) / range) * chartHeight;
    return { ...point, x, y };
  });
  const polyline = chartPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const latest = chartPoints[chartPoints.length - 1];

  return (
    <svg className="h-36 w-full text-foreground" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} role="img" aria-label={`${metricSeriesMetricLabel(metric)} 指标曲线`} preserveAspectRatio="none">
      {[0, 0.5, 1].map((ratio) => {
        const y = padding.top + ratio * chartHeight;
        return (
          <line
            key={ratio}
            x1={padding.left}
            x2={viewBoxWidth - padding.right}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.12"
          />
        );
      })}
      <text x="4" y={padding.top + 4} className="fill-muted-foreground text-[10px]">
        {formatMetricSeriesValue(metric, maxValue)}
      </text>
      <text x="4" y={viewBoxHeight - padding.bottom + 4} className="fill-muted-foreground text-[10px]">
        {formatMetricSeriesValue(metric, minValue)}
      </text>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polyline}
      />
      <circle cx={latest.x} cy={latest.y} r="4" fill="currentColor">
        <title>{formatDate(latest.sampledAt)} · {formatMetricSeriesValue(metric, latest.value)}</title>
      </circle>
      <text x={padding.left} y={viewBoxHeight - 8} className="fill-muted-foreground text-[10px]">
        {formatDate(series.firstSampledAt)}
      </text>
      <text x={viewBoxWidth - 104} y={viewBoxHeight - 8} className="fill-muted-foreground text-[10px]">
        {formatDate(series.lastSampledAt)}
      </text>
    </svg>
  );
}

function MetricTrendPanel({ trend }: { trend: ResourceMetricTrendSummary }) {
  return (
    <div className="border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">指标趋势</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {metricSourceLabel(trend.metricSource)} · 最近 {trend.windowMinutes} 分钟 · {trend.sampleCount} 个样本
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          更新于 {formatDate(trend.lastSampledAt)}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTrendValue label="CPU 当前" value={formatPercent(trend.cpuPercent.latest)} detail={`avg ${formatPercent(trend.cpuPercent.average)} · max ${formatPercent(trend.cpuPercent.max)} · ${formatSignedPercentDelta(trend.cpuPercent.delta) || '-'}`} />
        <MetricTrendValue label="内存当前" value={formatPercent(trend.memoryPercent.latest)} detail={`avg ${formatPercent(trend.memoryPercent.average)} · max ${formatPercent(trend.memoryPercent.max)} · ${formatSignedPercentDelta(trend.memoryPercent.delta) || '-'}`} />
        <MetricTrendValue label="内存用量" value={formatBytes(trend.memoryUsageBytes.latest)} detail={`avg ${formatBytes(trend.memoryUsageBytes.average)} · max ${formatBytes(trend.memoryUsageBytes.max)}`} />
        <MetricTrendValue label="PIDs" value={formatMetricNumber(trend.pids.latest)} detail={`avg ${formatMetricNumber(trend.pids.average)} · max ${formatMetricNumber(trend.pids.max)} · ${formatSignedNumberDelta(trend.pids.delta) || '-'}`} />
      </div>
    </div>
  );
}

function MetricTrendValue({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md bg-muted px-2.5 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-xs font-medium" title={value}>{value}</div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground" title={detail}>{detail}</div>
    </div>
  );
}

function HistorySection({
  title,
  emptyText,
  count,
  children,
}: {
  title: string;
  emptyText: string;
  count: number;
  children: any;
}) {
  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{count} 条</span>
      </div>
      {count === 0 ? (
        <div className="mt-3 rounded-md border px-3 py-4 text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <div className="mt-3 divide-y">{children}</div>
      )}
    </div>
  );
}

function MetricSnapshotItem({ snapshot }: { snapshot: ResourceMetricSnapshot }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{metricSourceLabel(snapshot.metricSource)}</span>
            {getStatusBadge(snapshot.status)}
            {snapshot.resourceActionRun && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {actionLabels[snapshot.resourceActionRun.action] || snapshot.resourceActionRun.action}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatDate(snapshot.sampledAt)} · {providerLabels[snapshot.provider] || snapshot.provider} / {kindLabels[snapshot.kind] || snapshot.kind}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <MetricSnapshotValue label="CPU" value={formatPercent(snapshot.cpuPercent)} />
            <MetricSnapshotValue label="内存" value={formatMetricMemory(snapshot)} />
            <MetricSnapshotValue label="网络入/出" value={`${formatBytes(snapshot.networkInputBytes)} / ${formatBytes(snapshot.networkOutputBytes)}`} />
            <MetricSnapshotValue label="块 IO 入/出" value={`${formatBytes(snapshot.blockInputBytes)} / ${formatBytes(snapshot.blockOutputBytes)}`} />
            <MetricSnapshotValue label="PIDs" value={snapshot.pids === null || snapshot.pids === undefined ? '-' : String(snapshot.pids)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricSnapshotValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-2.5 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-xs font-medium" title={value}>{value}</div>
    </div>
  );
}

function ActionRunItem({ run }: { run: ResourceActionRun }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{actionLabels[run.action] || run.action}</span>
            {getStatusBadge(run.status)}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {run.dryRun ? 'dry run' : 'live'}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {run.risk}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatDate(run.startedAt)} · {run.executorKey}/{run.adapterKey}
          </div>
          {run.serverExecutionJob && (
            <div className="mt-1 text-xs">
              <Link href="/execution-governance" className="text-primary hover:underline">
                Job {run.serverExecutionJob.id.slice(0, 8)} · {getStatusText(run.serverExecutionJob.status)}
              </Link>
            </div>
          )}
          {run.error && <div className="mt-1 text-xs text-destructive">{run.error}</div>}
        </div>
        {run.finishedAt && (
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            {formatDate(run.finishedAt)}
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionRunItem({ run }: { run: ResourceConnectionRun }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{run.targetEndpoint || run.resource?.endpoint || providerLabels[run.provider] || run.provider}</span>
            {getStatusBadge(run.status)}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {run.dryRun ? 'dry run' : 'live'}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatDate(run.startedAt)} · {run.authAdapterKey} · {run.executorKey}/{run.adapterKey}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {providerLabels[run.provider] || run.provider} / {kindLabels[run.kind] || run.kind}
          </div>
          {run.error && <div className="mt-1 text-xs text-destructive">{run.error}</div>}
        </div>
        {run.finishedAt && (
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            {formatDate(run.finishedAt)}
          </div>
        )}
      </div>
    </div>
  );
}

function QueryRunItem({ run }: { run: ResourceQueryRun }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{queryTypeLabels[run.queryType] || run.queryType}</span>
            {getStatusBadge(run.status)}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {run.dryRun ? 'dry run' : 'live'}
            </span>
            {run.result?.adapterState?.current && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {run.result.adapterState.current}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatDate(run.startedAt)} · {run.authAdapterKey} · {run.executorKey}/{run.adapterKey}
          </div>
          {run.query && (
            <pre className="mt-1 max-w-full truncate font-mono text-xs text-muted-foreground">
              {run.query}
            </pre>
          )}
          {run.error && <div className="mt-1 text-xs text-destructive">{run.error}</div>}
          <QueryPreview result={run.result} />
        </div>
        {run.finishedAt && (
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            {formatDate(run.finishedAt)}
          </div>
        )}
      </div>
    </div>
  );
}

function QueryPreview({ result }: { result?: ResourceQueryRunResult | null }) {
  const preview = result?.preview;
  const columns = preview?.columns?.slice(0, 4) || [];
  const rows = preview?.rows?.slice(0, 3) || [];

  if (!preview || columns.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-md border bg-muted/30 p-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{preview.sample ? '契约预览' : '查询结果'}</span>
        {result?.adapterState?.nextExecutorBoundary && (
          <span>{result.adapterState.nextExecutorBoundary}</span>
        )}
        {preview.pageInfo && (
          <span>
            {preview.pageInfo.returned ?? rows.length}/{preview.pageInfo.limit ?? '-'}
          </span>
        )}
        {preview.redaction?.enabled && <span>脱敏已启用</span>}
      </div>
      {rows.length > 0 ? (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                {columns.map((column) => (
                  <th key={column.key} className="px-2 py-1 font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t">
                  {columns.map((column) => (
                    <td key={column.key} className="max-w-[180px] truncate px-2 py-1 font-mono">
                      {formatPreviewValue(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">暂无预览行</div>
      )}
      {result?.livePrerequisites && result.livePrerequisites.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {result.livePrerequisites.slice(0, 4).map((item) => (
            <span key={item.key} className="px-2 py-0.5 rounded-full bg-background text-xs text-muted-foreground">
              {item.key}: {item.status}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function getStatusText(status: string) {
  const labels: Record<string, string> = {
    queued: '已入队',
    running: '运行中',
    active: '可用',
    completed: '完成',
    collected: '已采集',
    stopped: '已停止',
    inactive: '未启用',
    unknown: '未知',
    stale: '已过期',
    failed: '失败',
    error: '异常',
    blocked: '已阻止',
    partial: '部分采集',
  };

  return labels[status] || status;
}

function getStatusBadge(status: string) {
  const className = statusClasses[status] || 'bg-yellow-100 text-yellow-700';

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${className}`}>
      {getStatusText(status)}
    </span>
  );
}

function cloudProviderHealthStatusLabel(status: CloudProviderHealthSummary['status']) {
  const labels: Record<CloudProviderHealthSummary['status'], string> = {
    healthy: '健康',
    degraded: '降级',
    error: '异常',
    unknown: '未知',
  };
  return labels[status];
}

function cloudProviderHealthStatusClass(status: CloudProviderHealthSummary['status']) {
  const classes: Record<CloudProviderHealthSummary['status'], string> = {
    healthy: 'bg-green-100 text-green-700',
    degraded: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
    unknown: 'bg-gray-100 text-gray-700',
  };
  return classes[status];
}

function sourceTypeLabel(sourceType: string) {
  const labels: Record<string, string> = {
    server: '服务器',
    cloud: '云资源',
    manual: '手动录入',
  };
  return labels[sourceType] || sourceType;
}

const actionLabels: Record<string, string> = {
  'docker.container.inspect': '查看容器详情',
  'docker.container.logs': '查看容器日志',
  'docker.container.stats': '查看容器指标',
  'docker.container.restart': '重启容器',
  'mysql.connection.test': '测试 MySQL 连接',
  'mysql.backup.plan': '生成 MySQL 备份计划',
  'redis.info': '查看 Redis 信息',
  'redis.connection.ping': '测试 Redis 连接',
  'sls.logstores.list': '列出 SLS Logstore',
  'cos.objects.list': '列出 COS 对象',
};

const queryTypeLabels: Record<string, string> = {
  sql: 'SQL',
  redis_scan: 'Redis 浏览',
  sls_query: 'SLS 查询',
  cos_list: 'COS 列表',
  metadata: '元数据',
};

function buildCredentialConfig(form: {
  type: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  secretId: string;
  secretKey: string;
  defaultRegion: string;
  accountId: string;
  appId: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  sslMode: string;
}) {
  const compact = (value: string) => value.trim() || undefined;
  if (form.type === 'cloud_aliyun') {
    return stripEmptyValues({
      accessKeyId: form.accessKeyId,
      accessKeySecret: form.accessKeySecret,
      securityToken: form.securityToken,
      defaultRegion: form.defaultRegion,
      accountId: form.accountId,
    });
  }
  if (form.type === 'cloud_tencent') {
    return stripEmptyValues({
      secretId: form.secretId,
      secretKey: form.secretKey,
      defaultRegion: form.defaultRegion,
      appId: form.appId,
    });
  }
  return stripEmptyValues({
    host: form.host,
    port: form.port,
    username: form.username,
    password: form.password,
    database: form.database,
    sslMode: form.sslMode,
  });

  function stripEmptyValues(value: Record<string, string>) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, compact(item)] as const)
        .filter(([, item]) => Boolean(item)),
    );
  }
}

function isOperationCredential(credential: TeamCredential) {
  return credential.type.startsWith('cloud_') || credential.type.startsWith('db_') || credential.type === 'cdn_aliyun';
}

function credentialOptionsForProvider(
  provider: string,
  credentials: TeamCredential[],
  selectedCredentialId?: string,
) {
  const acceptedTypes = credentialTypesForProvider(provider);
  const compatible = acceptedTypes.length
    ? credentials.filter((credential) => acceptedTypes.includes(credential.type))
    : credentials;
  const selected = selectedCredentialId
    ? credentials.find((credential) => credential.id === selectedCredentialId)
    : undefined;
  if (selected && !compatible.some((credential) => credential.id === selected.id)) {
    return [selected, ...compatible];
  }
  return compatible;
}

function credentialTypesForProvider(provider: string) {
  if (provider === 'aliyun-rds' || provider === 'aliyun-sls') {
    return ['cloud_aliyun', 'cdn_aliyun'];
  }
  if (provider === 'tencent-cos') {
    return ['cloud_tencent'];
  }
  if (provider === 'all') {
    return ['cloud_aliyun', 'cloud_tencent', 'cdn_aliyun'];
  }
  return [];
}

function queryCredentialOptionsForResource(
  resource: ManagedResource | null,
  credentials: TeamCredential[],
  selectedCredentialId?: string,
) {
  const acceptedTypes = queryCredentialTypesForResource(resource);
  const compatible = acceptedTypes.length
    ? credentials.filter((credential) => acceptedTypes.includes(credential.type))
    : [];
  const selected = selectedCredentialId
    ? credentials.find((credential) => credential.id === selectedCredentialId)
    : undefined;
  if (selected && !compatible.some((credential) => credential.id === selected.id)) {
    return [selected, ...compatible];
  }
  return compatible;
}

function queryCredentialTypesForResource(resource: ManagedResource | null) {
  if (!resource) return [];
  if (resource.kind === 'mysql' || resource.kind === 'database') {
    return ['db_mysql_readonly'];
  }
  if (resource.kind === 'redis') {
    return ['db_redis_readonly'];
  }
  return [];
}

function queryCredentialIdOf(resource: ManagedResource) {
  const bindings = resource.config?.credentialBindings;
  if (bindings && typeof bindings === 'object' && !Array.isArray(bindings)) {
    const queryCredentialId = (bindings as Record<string, unknown>).queryCredentialId;
    return typeof queryCredentialId === 'string' ? queryCredentialId : '';
  }
  return '';
}

function supportsDirectDbLiveQuery(resource: ManagedResource) {
  return resource.kind === 'mysql' || resource.kind === 'database' || resource.kind === 'redis';
}

function canRunLiveQuery(resource: ManagedResource) {
  if (!supportsDirectDbLiveQuery(resource)) return false;
  const queryCredentialId = queryCredentialIdOf(resource);
  if (queryCredentialId) return true;
  return resource.credential?.type === 'db_mysql_readonly' || resource.credential?.type === 'db_redis_readonly';
}

function canRunLiveAction(resource: ManagedResource, action: ResourceActionDefinition) {
  const serverExecutorLiveActions = [
    'docker.container.inspect',
    'docker.container.logs',
    'docker.container.stats',
    'docker.container.restart',
    'mysql.connection.test',
    'redis.info',
  ];
  return resource.sourceType === 'server'
    && !action.dryRunOnly
    && serverExecutorLiveActions.includes(action.key);
}

function queryCredentialLabel(resource: ManagedResource, credentials: TeamCredential[]) {
  const credentialId = queryCredentialIdOf(resource) || resource.credential?.id;
  if (!credentialId) return '未绑定查询凭据';
  return credentials.find((credential) => credential.id === credentialId)?.name || '已绑定查询凭据';
}

function credentialTypeLabel(type: string) {
  const labels: Record<string, string> = {
    cloud_aliyun: '阿里云',
    cloud_tencent: '腾讯云',
    cdn_aliyun: '阿里云 CDN',
    db_mysql_readonly: 'MySQL 只读',
    db_redis_readonly: 'Redis 只读',
  };
  return labels[type] || type;
}

function defaultQueryType(resource: ManagedResource) {
  if (resource.kind === 'mysql' || resource.kind === 'database') return 'sql';
  if (resource.kind === 'redis') return 'redis_scan';
  if (resource.provider === 'aliyun-sls' || resource.kind === 'log_service') return 'sls_query';
  if (resource.provider === 'tencent-cos' || resource.kind === 'object_storage') return 'cos_list';
  return 'metadata';
}

function allowedQueryTypes(resource: ManagedResource) {
  return [defaultQueryType(resource)];
}

function defaultQueryText(resource: ManagedResource, queryType = defaultQueryType(resource)) {
  if (queryType === 'sql') return 'SELECT 1';
  if (queryType === 'redis_scan') return 'SCAN 0 COUNT 20';
  if (queryType === 'sls_query') return '*';
  if (queryType === 'cos_list') return '';
  return `${resource.provider}/${resource.kind} metadata`;
}

function getEnvironmentLabel(environments: ProjectEnvironment[], selectedEnvironmentId: string) {
  if (selectedEnvironmentId === 'all') return '未限定';
  const environment = environments.find((item) => item.id === selectedEnvironmentId);
  if (!environment) return '未知环境';
  return environment.project?.name ? `${environment.project.name} / ${environment.name}` : environment.name;
}

function getProjectLabel(projects: Array<{ id: string; name: string }>, selectedProjectId: string) {
  if (selectedProjectId === 'all') return '全部项目';
  return projects.find((project) => project.id === selectedProjectId)?.name || '未知项目';
}

function filterRunsByResource<T extends { startedAt: string; resource?: { id: string } | null }>(
  runs: T[],
  resourceId: string | null,
) {
  if (!resourceId) return [];
  return runs
    .filter((run) => run.resource?.id === resourceId)
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
}

function filterMetricSnapshotsByResource(
  snapshots: ResourceMetricSnapshot[],
  resourceId: string | null,
) {
  if (!resourceId) return [];
  return snapshots
    .filter((snapshot) => snapshot.resource?.id === resourceId || snapshot.resourceId === resourceId)
    .sort((left, right) => new Date(right.sampledAt).getTime() - new Date(left.sampledAt).getTime());
}

function buildLatestMetricSnapshotMap(snapshots: ResourceMetricSnapshot[]) {
  const latest = new Map<string, ResourceMetricSnapshot>();
  for (const snapshot of [...snapshots].sort((left, right) => new Date(right.sampledAt).getTime() - new Date(left.sampledAt).getTime())) {
    const resourceId = snapshot.resource?.id || snapshot.resourceId;
    if (resourceId && !latest.has(resourceId)) {
      latest.set(resourceId, snapshot);
    }
  }
  return latest;
}

function buildMetricTrendMap(trends: ResourceMetricTrendSummary[]) {
  const latest = new Map<string, ResourceMetricTrendSummary>();
  for (const trend of [...trends].sort((left, right) => new Date(right.lastSampledAt).getTime() - new Date(left.lastSampledAt).getTime())) {
    const resourceId = trend.resource?.id || trend.resourceId;
    if (resourceId && !latest.has(resourceId)) {
      latest.set(resourceId, trend);
    }
  }
  return latest;
}

function getCloudSyncProviderDiagnostics(run: ResourceSyncRun): CloudSyncProviderDiagnostic[] {
  if (run.sourceType !== 'cloud') return [];
  const metadata = asRecord(run.metadata);
  const providers = metadata ? metadata.providers : undefined;
  if (!Array.isArray(providers)) return [];
  return providers
    .map((provider) => toCloudSyncProviderDiagnostic(provider))
    .filter((diagnostic): diagnostic is CloudSyncProviderDiagnostic => Boolean(diagnostic));
}

function toCloudSyncProviderDiagnostic(value: unknown): CloudSyncProviderDiagnostic | null {
  const record = asRecord(value);
  if (!record) return null;
  const provider = readString(record.provider);
  if (!provider) return null;

  return {
    provider,
    syncMode: readString(record.syncMode),
    parsedCount: readNumber(record.parsedCount),
    skippedCount: readNumber(record.skippedCount),
    errors: readStringArray(record.errors),
    fallbackReason: readString(record.fallbackReason),
    live: readBoolean(record.live),
    sdk: readString(record.sdk),
    regions: readStringArray(record.regions),
    requestPolicy: asRecord(record.requestPolicy),
  };
}

function formatCloudSyncRequestPolicy(policy?: Record<string, unknown> | null) {
  if (!policy) return '';
  const timeoutMs = readNumber(policy.timeoutMs);
  const retryAttempts = readNumber(policy.retryAttempts);
  const attempts = readNumber(policy.attempts);
  const retries = readNumber(policy.retries);
  const parts = [
    timeoutMs !== undefined ? `timeout ${timeoutMs}ms` : '',
    attempts !== undefined ? `attempts ${attempts}` : '',
    retryAttempts !== undefined ? `retry limit ${retryAttempts}` : '',
    retries !== undefined ? `retries ${retries}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function formatOptionalNumber(value?: number) {
  return value === undefined ? '-' : String(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function formatJsonValue(value?: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) return '无';
  return JSON.stringify(redactSecretLikeValues(value), null, 2);
}

function redactSecretLikeValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretLikeValues(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (isSecretLikeKey(key)) {
        return [key, '[redacted]'];
      }
      return [key, redactSecretLikeValues(item)];
    }),
  );
}

function isSecretLikeKey(key: string) {
  return /(password|secret|token|accessKey|privateKey|credential)/i.test(key);
}

function formatPreviewValue(value: unknown) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function metricSourceLabel(metricSource: string) {
  const labels: Record<string, string> = {
    docker_stats: 'Docker stats',
  };
  return labels[metricSource] || metricSource;
}

function metricSeriesMetricLabel(metric: ResourceMetricSeriesMetric) {
  return metricSeriesMetricOptions.find((option) => option.value === metric)?.label || metric;
}

function isByteMetric(metric: ResourceMetricSeriesMetric) {
  return metric === 'memoryUsageBytes' ||
    metric === 'networkInputBytes' ||
    metric === 'networkOutputBytes' ||
    metric === 'blockInputBytes' ||
    metric === 'blockOutputBytes';
}

function formatMetricSeriesValue(metric: ResourceMetricSeriesMetric, value?: number | null) {
  if (metric === 'cpuPercent' || metric === 'memoryPercent') {
    return formatPercent(value);
  }
  if (isByteMetric(metric)) {
    return formatBytes(value);
  }
  return formatMetricNumber(value);
}

function formatMetricSeriesDelta(metric: ResourceMetricSeriesMetric, value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  if (metric === 'cpuPercent' || metric === 'memoryPercent') {
    return formatSignedPercentDelta(value);
  }
  if (isByteMetric(metric)) {
    if (value > 0) return `+${formatBytes(value)}`;
    if (value < 0) return `-${formatBytes(Math.abs(value))}`;
    return '0 B';
  }
  return formatSignedNumberDelta(value);
}

function formatMetricWindow(minutes: number) {
  if (!Number.isFinite(minutes)) return '-';
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} 天`;
  if (minutes >= 60) return `${Math.round(minutes / 60)} 小时`;
  return `${minutes} 分钟`;
}

function formatMetricMemory(snapshot: ResourceMetricSnapshot) {
  const usage = formatBytes(snapshot.memoryUsageBytes);
  const limit = formatBytes(snapshot.memoryLimitBytes);
  const percent = formatPercent(snapshot.memoryPercent);
  if (usage === '-' && limit === '-') return percent;
  return `${usage} / ${limit} (${percent})`;
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function formatSignedPercentDelta(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const formatted = `${Math.abs(value).toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return '0%';
}

function formatSignedNumberDelta(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  if (value > 0) return `+${formatMetricNumber(value)}`;
  if (value < 0) return `-${formatMetricNumber(Math.abs(value))}`;
  return '0';
}

function formatMetricNumber(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = value;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  const digits = amount >= 10 || index === 0 ? 0 : 1;
  return `${amount.toFixed(digits)} ${units[index]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
