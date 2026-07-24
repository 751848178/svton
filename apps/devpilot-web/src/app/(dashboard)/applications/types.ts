/**
 * 应用服务域类型
 *
 * 单一职责：仅声明接口。
 */

import type { ServiceSloDashboardRow } from '../monitoring/types-dashboard';

export interface Project {
  id: string;
  name: string;
}

export interface ProjectEnvironment {
  id: string;
  key: string;
  name: string;
  status: string;
  project?: Project | null;
}

export interface Server {
  id: string;
  name: string;
  host: string;
  status: string;
}

export interface Site {
  id: string;
  name: string;
  primaryDomain: string;
  projectId?: string | null;
  environmentId?: string | null;
}

export interface ManagedResource {
  id: string;
  name: string;
  provider: string;
  kind: string;
  status: string;
  project?: Project | null;
  environment?: ProjectEnvironment | null;
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

export type ServiceAction = 'status' | 'logs' | 'restart' | 'rollback';

export interface OperationRun {
  id: string;
  action: ServiceAction;
  dryRun: boolean;
  risk: 'low' | 'medium' | 'high';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked';
  serverExecutionJobId?: string | null;
  serverExecutionJob?: ServerExecutionJobRef | null;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export interface ApplicationServiceItem {
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

export interface ApplicationItem {
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

export interface AppForm {
  projectId: string;
  name: string;
  repositoryUrl: string;
  defaultBranch: string;
  repoPath: string;
}

export interface ServiceForm {
  applicationId: string;
  environmentId: string;
  name: string;
  kind: string;
  runtime: string;
  serverId: string;
  siteId: string;
  managedResourceId: string;
  workingDirectory: string;
  buildCommand: string;
  deployCommand: string;
  healthCheckUrl: string;
}

export interface AppStats {
  applications: number;
  services: number;
  environments: number;
  deployments: number;
  operations: number;
}

/**
 * 部署运行（applications 域精简视图）。
 *
 * 来自 POST /deployments/projects/:projectId/runs 的创建响应 / GET /deployments/runs 的列表项。
 * commandPlan 是后端 Json? 标量（含 checkout/build/write_env/deploy/health_check 步骤，
 * .env 真值已脱敏为 ***REDACTED***），用 unknown 承载，由 deployment-command-parser 解析。
 */
export interface CreatedDeploymentRun {
  id: string;
  status: string;
  dryRun: boolean;
  mode?: string | null;
  branch?: string | null;
  commitSha?: string | null;
  environment?: string | null;
  commandPlan?: unknown;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  operationApproval?: {
    id: string;
    status: string;
    risk: string;
    reviewedAt?: string | null;
    consumedAt?: string | null;
  } | null;
  serverExecutionJob?: {
    id: string;
    status: string;
    queueMode: string;
  } | null;
  projectEnvironment?: { id: string; key: string; name: string; status: string } | null;
}

export type ServiceSloRow = ServiceSloDashboardRow & {
  generatedAt: string;
  windowMinutes: number;
};
