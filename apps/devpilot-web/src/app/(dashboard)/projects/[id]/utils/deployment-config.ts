/**
 * 项目详情域 - 配置对比工具
 *
 * 单一职责：环境配置画像构建、差异计算、部署命令解析（纯函数）。
 */

import type { Project, ProjectServiceWithApplication } from '../types';
import type { DeploymentRun } from '../types/operations';
import type { DeployConfigCoverage, EnvironmentConfigProfile } from '../types/environment-sync';
import { resourceProviderLabels, resourceKindLabels } from '../constants';
import {
  buildConfigDifferences,
  findConfigReferenceProfile,
} from './deployment-config-differences.utils';

export {
  buildConfigDifferences,
  findConfigReferenceProfile,
  previewList,
} from './deployment-config-differences.utils';

export function isDeploymentCommandStep(
  value: unknown,
): value is { key: string; label: string; command?: string; cwd?: string; required?: boolean } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const step = value as Record<string, unknown>;
  return typeof step.key === 'string' && typeof step.label === 'string';
}

export function readDeploymentCommandSteps(commandPlan: unknown) {
  const steps = Array.isArray(commandPlan)
    ? commandPlan
    : typeof commandPlan === 'object' &&
        commandPlan !== null &&
        Array.isArray((commandPlan as { steps?: unknown }).steps)
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

export function matchesProjectEnvironment(
  environment: { id?: string | null; key?: string | null; name?: string | null } | null | undefined,
  selectedEnvironment: { id: string; key: string; name: string } | null,
  fallbackEnvironment?: string | null,
): boolean {
  if (!selectedEnvironment) return false;
  if (environment?.id) return environment.id === selectedEnvironment.id;
  if (fallbackEnvironment) {
    return (
      fallbackEnvironment === selectedEnvironment.key ||
      fallbackEnvironment === selectedEnvironment.name
    );
  }
  return false;
}

export function uniqueSorted(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

export function readConfigString(
  config: Record<string, unknown> | null | undefined,
  key: string,
): string {
  const value = config?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function siteTlsEnabled(site: NonNullable<Project['sites']>[number]): boolean {
  const tls = site.tls;
  if (!tls || typeof tls !== 'object' || Array.isArray(tls)) return false;
  return tls.enabled === true || (typeof tls.type === 'string' && tls.type !== 'none');
}

export function formatDeployConfigCoverage(coverage: DeployConfigCoverage): string {
  if (coverage.total === 0) return '无服务';
  return `${coverage.deployCommand}/${coverage.total} 部署`;
}

export function buildDeployConfigCoverage(
  services: ProjectServiceWithApplication[],
): DeployConfigCoverage {
  return {
    total: services.length,
    workingDirectory: services.filter((s) => readConfigString(s.deployConfig, 'workingDirectory'))
      .length,
    buildCommand: services.filter((s) => readConfigString(s.deployConfig, 'buildCommand')).length,
    deployCommand: services.filter((s) => readConfigString(s.deployConfig, 'deployCommand')).length,
    healthCheckUrl: services.filter((s) => readConfigString(s.deployConfig, 'healthCheckUrl'))
      .length,
    rollbackCommand: services.filter((s) => readConfigString(s.deployConfig, 'rollbackCommand'))
      .length,
  };
}

export function buildEnvironmentConfigProfiles(
  project: Project,
  deploymentRuns: DeploymentRun[],
  environments: NonNullable<Project['environments']>,
): EnvironmentConfigProfile[] {
  const profiles = environments.map((environment) => {
    const services: ProjectServiceWithApplication[] = (project.applications || []).flatMap((app) =>
      app.services
        .filter((s) => matchesProjectEnvironment(s.environment, environment))
        .map((s) => ({ ...s, applicationName: app.name })),
    );
    const sites = (project.sites || []).filter((s) =>
      matchesProjectEnvironment(s.environment, environment),
    );
    const managedResources = (project.managedResources || []).filter((r) =>
      matchesProjectEnvironment(r.environment, environment),
    );
    const resourceInstances = (project.resourceInstances || []).filter((i) =>
      matchesProjectEnvironment(i.projectEnvironment, environment),
    );
    const secretKeys = (project.secretKeys || []).filter((s) =>
      matchesProjectEnvironment(s.environment, environment),
    );
    const deployments = deploymentRuns.filter((r) =>
      matchesProjectEnvironment(r.projectEnvironment, environment, r.environment),
    );
    const serverBindings = environment.serverBindings || [];
    return {
      environment,
      isReference: false,
      serviceKeys: uniqueSorted(services.map((s) => `${s.applicationName}/${s.name}`)),
      serverKeys: uniqueSorted(serverBindings.map((b) => b.server.host || b.server.name)),
      resourceKindKeys: uniqueSorted([
        ...managedResources.map(
          (r) =>
            `${resourceProviderLabels[r.provider] || r.provider}/${resourceKindLabels[r.kind] || r.kind}`,
        ),
        ...resourceInstances.map(
          (i) => i.resourceType?.key || i.resourceType?.name || 'resource_instance',
        ),
      ]),
      siteRuntimeKeys: uniqueSorted(
        sites.map((s) => `${s.runtimeType}${s.server ? `@${s.server.name}` : ''}`),
      ),
      secretTypeKeys: uniqueSorted(secretKeys.map((s) => s.type)),
      siteCount: sites.length,
      tlsSiteCount: sites.filter((s) => siteTlsEnabled(s)).length,
      serviceBindingGapCount: services.filter((s) => !s.server && !s.site && !s.managedResource)
        .length,
      deployConfigCoverage: buildDeployConfigCoverage(services),
      successfulDeployments: deployments.filter((r) => r.status === 'completed').length,
      differences: [] as string[],
    };
  });
  const reference = findConfigReferenceProfile(profiles);
  return profiles.map((p) => ({
    ...p,
    isReference: Boolean(reference && p.environment.id === reference.environment.id),
    differences: reference ? buildConfigDifferences(p, reference) : [],
  }));
}
