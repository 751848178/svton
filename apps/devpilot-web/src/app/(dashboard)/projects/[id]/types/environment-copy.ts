/**
 * 项目详情域 - 环境复制类型
 *
 * 单一职责：资源批量绑定、站点/CDN/资源/密钥复制流程相关接口。
 */

export type EnvironmentResourceBulkBindType =
  | 'managed_resource'
  | 'resource_instance'
  | 'site'
  | 'cdn_config'
  | 'secret_key';

export type EnvironmentResourceBulkBindSelectionKey =
  | 'managedResourceIds'
  | 'resourceInstanceIds'
  | 'siteIds'
  | 'cdnConfigIds'
  | 'secretKeyIds';

export interface EnvironmentResourceBulkBindSelection {
  managedResourceIds: string[];
  resourceInstanceIds: string[];
  siteIds: string[];
  cdnConfigIds: string[];
  secretKeyIds: string[];
}

export interface EnvironmentResourceBulkBindStep {
  type: EnvironmentResourceBulkBindType | string;
  status: 'planned' | 'applied' | 'skipped' | string;
  resourceId: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface EnvironmentResourceBulkBindResult {
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

export interface EnvironmentSiteCopyStep {
  status: 'planned' | 'applied' | 'skipped' | string;
  sourceSiteId: string;
  targetSiteId?: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface EnvironmentSiteCopyResult {
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

export interface EnvironmentCdnConfigCopyStep {
  status: 'planned' | 'applied' | 'skipped' | string;
  sourceCdnConfigId: string;
  targetCdnConfigId?: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface EnvironmentCdnConfigCopyResult {
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

export interface EnvironmentResourceCopyStep {
  type: 'managed_resource' | 'secret_key' | string;
  status: 'planned' | 'applied' | 'skipped' | string;
  sourceId: string;
  targetId?: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface EnvironmentResourceCopyResult {
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
