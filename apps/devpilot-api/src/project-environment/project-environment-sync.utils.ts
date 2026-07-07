/**
 * Pure helpers for the project-environment sync-suggestions service.
 *
 * Owns the sync-apply constants, the apply-step type, and the per-environment
 * sync profile builder. Extracted from `ProjectEnvironmentSyncService` to keep
 * that service under the file-size ceiling. All functions are pure.
 */

import { DeployConfigField, EnvironmentSyncProfile } from './project-environment.service';
import {
  buildDeployConfigCoverage as buildDeployConfigCoverageUtil,
} from './project-environment-sync-diff.utils';
import {
  siteTlsEnabled as siteTlsEnabledUtil,
  uniqueSorted as uniqueSortedUtil,
} from './project-environment-helpers.utils';

export const DEPLOY_CONFIG_FIELDS: DeployConfigField[] = [
  'workingDirectory',
  'buildCommand',
  'deployCommand',
  'healthCheckUrl',
  'rollbackCommand',
];

export const DEPLOY_CONFIG_FIELD_LABELS: Record<DeployConfigField, string> = {
  workingDirectory: '工作目录',
  buildCommand: '构建命令',
  deployCommand: '部署命令',
  healthCheckUrl: '健康检查',
  rollbackCommand: '回滚命令',
};

export const APPLYABLE_SYNC_ACTION_KINDS = new Set([
  'create_missing_service',
  'complete_deploy_config',
]);

export const DEFAULT_SYNC_ACTION_KINDS = [
  'create_missing_service',
  'complete_deploy_config',
  'bind_server_role',
  'bind_service_runtime',
  'bind_resource_kind',
  'create_site_runtime',
  'create_cdn_config',
  'create_secret_type',
  'enable_site_tls',
  'run_deployment',
];

export type EnvironmentSyncApplyStepStatus = 'planned' | 'applied' | 'skipped';

export type EnvironmentSyncApplyStep = {
  kind: string;
  status: EnvironmentSyncApplyStepStatus;
  title: string;
  description: string;
  targetType: string;
  sourceId?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Indexed lookups of sync-relevant entities keyed by environment id. */
export interface SyncEnvironmentInventory {
  services: Map<string, any[]>;
  deploymentRuns: Map<string, any[]>;
  sites: Map<string, any[]>;
  managedResources: Map<string, any[]>;
  resourceInstances: Map<string, any[]>;
  cdnConfigs: Map<string, any[]>;
  secretKeys: Map<string, any[]>;
}

/**
 * Build a base (pre-reference) sync profile for a single environment from the
 * grouped inventory lookups. Pure projection: no I/O, no mutation.
 */
export function buildEnvironmentSyncProfile(environment: any, inventory: SyncEnvironmentInventory): EnvironmentSyncProfile {
  const environmentServices = inventory.services.get(environment.id) || [];
  const environmentDeploymentRuns = inventory.deploymentRuns.get(environment.id) || [];
  const environmentSites = inventory.sites.get(environment.id) || [];
  const environmentManagedResources = inventory.managedResources.get(environment.id) || [];
  const environmentResourceInstances = inventory.resourceInstances.get(environment.id) || [];
  const environmentCdnConfigs = inventory.cdnConfigs.get(environment.id) || [];
  const environmentSecretKeys = inventory.secretKeys.get(environment.id) || [];

  return {
    environment: {
      id: environment.id,
      key: environment.key,
      name: environment.name,
      status: environment.status,
      sortOrder: environment.sortOrder,
    },
    isReference: false,
    serverRoleKeys: uniqueSortedUtil(
      environment.serverBindings.map((binding: any) => binding.role || 'mixed'),
    ),
    serverKeys: uniqueSortedUtil(
      environment.serverBindings.map((binding: any) => binding.server.host || binding.server.name),
    ),
    serviceKeys: uniqueSortedUtil(
      environmentServices.map((service: any) => `${service.application.name}/${service.name}`),
    ),
    resourceKindKeys: uniqueSortedUtil([
      ...environmentManagedResources.map((resource: any) => `${resource.provider}/${resource.kind}`),
      ...environmentResourceInstances.map((instance: any) =>
        instance.resourceType?.key || instance.resourceType?.name || 'resource_instance',
      ),
    ]),
    siteRuntimeKeys: uniqueSortedUtil(environmentSites.map((site: any) => site.runtimeType)),
    secretTypeKeys: uniqueSortedUtil(environmentSecretKeys.map((secret: any) => secret.type)),
    cdnProviderKeys: uniqueSortedUtil(environmentCdnConfigs.map((config: any) => config.provider)),
    counts: {
      serverBindings: environment.serverBindings.length,
      services: environmentServices.length,
      managedResources: environmentManagedResources.length,
      resourceInstances: environmentResourceInstances.length,
      resources: environmentManagedResources.length + environmentResourceInstances.length,
      sites: environmentSites.length,
      cdnConfigs: environmentCdnConfigs.length,
      secretKeys: environmentSecretKeys.length,
      deploymentRuns: environmentDeploymentRuns.length,
    },
    deployConfigCoverage: buildDeployConfigCoverageUtil(environmentServices),
    serviceBindingGapCount: environmentServices.filter((service: any) =>
      !service.serverId && !service.siteId && !service.managedResourceId,
    ).length,
    tlsSiteCount: environmentSites.filter((site: any) => siteTlsEnabledUtil(site.tls)).length,
    successfulDeployments: environmentDeploymentRuns.filter((run: any) => run.status === 'completed').length,
  };
}

/** Shared where-clause shape for sync inventory reads scoped to a team/project. */
function scopedWhere(teamId: string, projectId: string, environmentIds: string[]) {
  return { teamId, projectId, environmentId: { in: environmentIds } };
}

export const syncApplicationServicesArgs = (teamId: string, projectId: string, environmentIds: string[]) => ({
  where: { ...scopedWhere(teamId, projectId, environmentIds), status: { not: 'archived' } },
  select: {
    id: true, name: true, kind: true, runtime: true, environmentId: true,
    serverId: true, siteId: true, managedResourceId: true, deployConfig: true,
    application: { select: { id: true, name: true } },
  },
});

export const syncDeploymentRunsArgs = (teamId: string, projectId: string, environmentIds: string[]) => ({
  where: scopedWhere(teamId, projectId, environmentIds),
  select: { id: true, environmentId: true, status: true },
});

export const syncSitesArgs = (teamId: string, projectId: string, environmentIds: string[]) => ({
  where: scopedWhere(teamId, projectId, environmentIds),
  select: { id: true, environmentId: true, runtimeType: true, tls: true, serverId: true },
});

export const syncManagedResourcesArgs = (teamId: string, projectId: string, environmentIds: string[]) => ({
  where: scopedWhere(teamId, projectId, environmentIds),
  select: { id: true, environmentId: true, provider: true, kind: true },
});

export const syncResourceInstancesArgs = (teamId: string, projectId: string, environmentIds: string[]) => ({
  where: scopedWhere(teamId, projectId, environmentIds),
  select: {
    id: true, environmentId: true,
    resourceType: { select: { id: true, key: true, name: true, category: true } },
  },
});

export const syncCdnConfigsArgs = (teamId: string, projectId: string, environmentIds: string[]) => ({
  where: scopedWhere(teamId, projectId, environmentIds),
  select: { id: true, environmentId: true, provider: true, status: true },
});

export const syncSecretKeysArgs = (teamId: string, projectId: string, environmentIds: string[]) => ({
  where: scopedWhere(teamId, projectId, environmentIds),
  select: { id: true, environmentId: true, type: true },
});
