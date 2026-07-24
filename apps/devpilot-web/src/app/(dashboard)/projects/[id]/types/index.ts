/**
 * 项目详情域类型定义
 *
 * 单一职责：仅声明接口、类型别名。
 * 按业务子域分组导出。
 */

export interface ProjectEnvironment {
  id: string;
  key: string;
  name: string;
  status: string;
  sortOrder: number;
  /**
   * 环境级配置（后端 ProjectEnvironment.config Json?）。
   * 其中 `envVars` 承载该环境的普通（非密钥）环境变量 KEY=VALUE，由部署注入
   * （见 resolveDeploymentEnvVars）。
   */
  config?: {
    envVars?: Record<string, string>;
    [key: string]: unknown;
  } | null;
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
}

export interface ProjectAllocation {
  id: string;
  resourceName: string;
  status: string;
  createdAt?: string;
  releasedAt?: string | null;
  pool?: { id: string; name: string; type: string } | null;
}

export interface ProjectSite {
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
}

export interface ProjectProxyConfig {
  id: string;
  name: string;
  domain: string;
  status: string;
}

export interface ProjectCdnConfig {
  id: string;
  name: string;
  domain: string;
  origin: string;
  provider: string;
  credentialId?: string | null;
  cacheRules?: Array<{ path: string; ttl: number }> | null;
  status?: string;
  environment?: { id: string; key: string; name: string; status: string } | null;
}

export interface ProjectManagedResource {
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
}

export interface ProjectResourceInstance {
  id: string;
  name: string;
  status: string;
  expiresAt?: string | null;
  createdAt: string;
  projectEnvironment?: { id: string; key: string; name: string; status: string } | null;
  resourceType?: {
    id: string;
    key: string;
    name: string;
    category: string;
    /** 是否拥有 envTemplate（决定该实例绑定环境后是否会被部署注入）。
     *  后端 resource-type.service 默认返回该字段；前端此前类型漏了，这里补上。 */
    envTemplate?: string | null;
  } | null;
  request?: { id: string; title: string; status: string } | null;
}

export interface ProjectSecretKey {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  createdAt: string;
}

export interface ProjectService {
  id: string;
  name: string;
  kind: string;
  runtime?: string | null;
  deployConfig?: Record<string, unknown> | null;
  status: string;
  environment?: { id: string; key: string; name: string; status: string } | null;
  server?: { id: string; name: string; host: string; status: string } | null;
  site?: { id: string; name: string; primaryDomain: string; status: string } | null;
  managedResource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    status: string;
  } | null;
  _count?: { deploymentRuns: number; operationRuns: number };
}

export interface ProjectApplication {
  id: string;
  name: string;
  repositoryUrl?: string | null;
  defaultBranch?: string | null;
  services: ProjectService[];
  _count?: { services: number; deploymentRuns: number; operationRuns: number };
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  gitRepo: string | null;
  downloadUrl: string | null;
  config: unknown;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string | null; email: string };
  allocations?: ProjectAllocation[];
  environments?: ProjectEnvironment[];
  sites?: ProjectSite[];
  proxyConfigs?: ProjectProxyConfig[];
  cdnConfigs?: ProjectCdnConfig[];
  managedResources?: ProjectManagedResource[];
  resourceInstances?: ProjectResourceInstance[];
  secretKeys?: ProjectSecretKey[];
  applications?: ProjectApplication[];
}

export type ProjectServiceWithApplication = ProjectService & { applicationName: string };
