/**
 * 项目详情域 - 运维操作类型
 *
 * 单一职责：服务器、凭证、部署、Webhook、环境同步相关接口。
 */

export interface ProjectServerOption {
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

export interface TeamCredentialOption {
  id: string;
  type: string;
  name: string;
  createdAt: string;
}

export interface DeploymentCommandStep {
  key: string;
  label: string;
  command: string;
  cwd: string;
  required: boolean;
}

export interface DeploymentRun {
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

export interface ProjectWebhook {
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

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  signatureStatus: string;
  status: string;
  message: string | null;
  receivedAt: string;
  deploymentRun?: { id: string; status: string; dryRun: boolean } | null;
}

export type WebhookTriggerMode = 'push' | 'pr_preview';
export type WebhookDeploymentMode = 'dry_run' | 'queue' | 'live_request' | 'preview';

export interface GeneratedResourceResolution {
  type: string;
  mode: string;
  sourceId?: string | null;
  name?: string | null;
  resourceName?: string | null;
}
