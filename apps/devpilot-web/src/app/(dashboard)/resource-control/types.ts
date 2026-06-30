/** 资源管控域类型 - 基础实体与操作接口。 */

export interface Server {
  id: string;
  name: string;
  host: string;
  status: 'online' | 'offline' | 'unknown';
}

export interface ManagedResource {
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

export interface ProjectEnvironment {
  id: string;
  key: string;
  name: string;
  status: string;
  project?: { id: string; name: string } | null;
}

export interface TeamCredential {
  id: string;
  type: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ServerExecutionJobRef {
  id: string;
  status: string;
  queueMode: string;
  attempt: number;
  maxAttempts: number;
  queuedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface CredentialProfile {
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

export interface ResourceSyncRun {
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

export interface CloudSyncProviderDiagnostic {
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

export interface CloudProviderHealthIssue {
  runId: string;
  type: 'sync_failed' | 'provider_failure';
  status: string;
  message: string;
  startedAt: string;
}

export interface CloudProviderHealthSummary {
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

export interface ResourceActionDefinition {
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

export interface ResourceActionRun {
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
