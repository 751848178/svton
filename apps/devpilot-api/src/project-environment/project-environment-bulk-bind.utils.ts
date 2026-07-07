/**
 * Pure step/result builders for the project-environment bulk-bind service.
 *
 * Owns the per-type binding-step shaping (managed_resource / resource_instance
 * / site / cdn_config / secret_key) and the final bulk-bind result assembly.
 * Extracted from `ProjectEnvironmentBulkBindService` to keep that service under
 * the file-size ceiling. All functions are pure.
 */

export type EnvironmentResourceBindingType =
  | 'managed_resource' | 'resource_instance' | 'site' | 'cdn_config' | 'secret_key';

export type EnvironmentResourceBindingStep = {
  type: EnvironmentResourceBindingType;
  status: 'planned' | 'applied' | 'skipped';
  resourceId: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
};

function step(
  type: EnvironmentResourceBindingType,
  status: 'planned' | 'applied',
  resourceId: string,
  title: string,
  description: string,
  metadata?: Record<string, unknown>,
): EnvironmentResourceBindingStep {
  return { type, status, resourceId, title, description, metadata };
}

export function buildManagedResourceBindingSteps(resources: any[], status: 'planned' | 'applied', environmentName: string): EnvironmentResourceBindingStep[] {
  return resources.map((resource) => step(
    'managed_resource', status, resource.id,
    `${resource.provider}/${resource.kind} ${resource.name}`,
    `绑定托管资源到 ${environmentName}`,
    { provider: resource.provider, kind: resource.kind, status: resource.status, endpoint: resource.endpoint },
  ));
}

export function buildResourceInstanceBindingSteps(resources: any[], status: 'planned' | 'applied', environmentName: string): EnvironmentResourceBindingStep[] {
  return resources.map((resource) => step(
    'resource_instance', status, resource.id,
    `资源实例 ${resource.name}`,
    `绑定资源实例到 ${environmentName}`,
    { status: resource.status, resourceType: resource.resourceType?.key || resource.resourceType?.name },
  ));
}

export function buildSiteBindingSteps(sites: any[], status: 'planned' | 'applied', environmentName: string): EnvironmentResourceBindingStep[] {
  return sites.map((site) => step(
    'site', status, site.id,
    `站点 ${site.name}`,
    `绑定站点 ${site.primaryDomain} 到 ${environmentName}`,
    { runtimeType: site.runtimeType, status: site.status, primaryDomain: site.primaryDomain },
  ));
}

export function buildCdnConfigBindingSteps(configs: any[], status: 'planned' | 'applied', environmentName: string): EnvironmentResourceBindingStep[] {
  return configs.map((config) => step(
    'cdn_config', status, config.id,
    `CDN ${config.name}`,
    `绑定 CDN ${config.domain} 到 ${environmentName}`,
    { provider: config.provider, status: config.status, domain: config.domain },
  ));
}

export function buildSecretKeyBindingSteps(secrets: any[], status: 'planned' | 'applied', environmentName: string): EnvironmentResourceBindingStep[] {
  return secrets.map((secret) => step(
    'secret_key', status, secret.id,
    `密钥 ${secret.name}`,
    `绑定密钥类型 ${secret.type} 到 ${environmentName}，不会读取或修改密钥值`,
    { type: secret.type, hasDescription: Boolean(secret.description) },
  ));
}

/** Aggregate the resource ids for the binding write. */
export function collectBindingIds(
  managedResources: any[], resourceInstances: any[], sites: any[], cdnConfigs: any[], secretKeys: any[],
) {
  return {
    managedResourceIds: managedResources.map((r: any) => r.id),
    resourceInstanceIds: resourceInstances.map((r: any) => r.id),
    siteIds: sites.map((s: any) => s.id),
    cdnConfigIds: cdnConfigs.map((c: any) => c.id),
    secretKeyIds: secretKeys.map((s: any) => s.id),
  };
}

/** Assemble the final bulk-bind result object (counts + summary + warnings). */
export function buildBulkBindResult(
  projectId: string, environment: any, dryRun: boolean,
  steps: EnvironmentResourceBindingStep[],
  managedResources: any[], resourceInstances: any[], sites: any[], cdnConfigs: any[], secretKeys: any[],
) {
  return {
    projectId,
    environment: { id: environment.id, key: environment.key, name: environment.name },
    dryRun,
    status: dryRun ? 'planned' : 'completed',
    plannedCount: steps.filter((s) => s.status === 'planned').length,
    appliedCount: steps.filter((s) => s.status === 'applied').length,
    skippedCount: steps.filter((s) => s.status === 'skipped').length,
    steps,
    summary: {
      managedResources: managedResources.length,
      resourceInstances: resourceInstances.length,
      sites: sites.length,
      cdnConfigs: cdnConfigs.length,
      secretKeys: secretKeys.length,
    },
    warnings: [
      '只绑定现有项目资源的环境归属，不复制、创建或删除实际服务器/云资源。',
      '密钥只更新 environmentId，不读取、不解密、不修改 value。',
    ],
  };
}
