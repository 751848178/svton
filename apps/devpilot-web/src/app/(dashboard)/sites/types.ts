/** 站点域类型 - Site/Server/Plan/SyncRun/Takeover 接口。 */

export type SiteRuntimeType = 'reverse_proxy' | 'static' | 'docker' | 'runtime';

export interface Site {
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

export interface Server {
  id: string;
  name: string;
  host: string;
  status: string;
}

export interface Project {
  id: string;
  name: string;
}

export interface ProjectEnvironment {
  id: string;
  projectId: string;
  key: string;
  name: string;
  status: string;
}

export interface ProxyConfig {
  id: string;
  name: string;
  domain: string;
  status: string;
}

export interface SitePlanStep {
  key: string;
  label: string;
  command: string;
  required: boolean;
  preview?: string;
}

export interface SiteSyncPlan {
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

export interface SiteConfigDiff {
  sourceRunId?: string | null;
  hasBaseline: boolean;
  hasChanges: boolean;
  added: number;
  removed: number;
  unchanged: number;
  summary: string;
  unifiedDiff: string;
}

export interface SiteSyncRun {
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
  operationApproval?: {
    id: string;
    status: string;
    risk: string;
    reviewedAt?: string | null;
    consumedAt?: string | null;
  } | null;
  actor?: { id: string; name?: string | null; email?: string | null } | null;
}

export interface SiteTakeoverForm {
  serverId: string;
  upstreamUrl: string;
  websocket: boolean;
  tlsEnabled: boolean;
  tlsType: string;
  tlsEmail: string;
  tlsCertName: string;
  tlsAssetId: string;
}

export interface PreviewSiteTakeoverResult {
  site: Site;
  syncPlan?: SiteSyncPlan | null;
}
