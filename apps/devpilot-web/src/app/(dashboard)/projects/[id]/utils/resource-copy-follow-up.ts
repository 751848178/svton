import type { ProjectManagedResource } from '../types';
import { buildScopedHref } from './environment-sync';

export function buildResourceCopyAuditHref(
  projectId: string,
  environmentId?: string | null,
): string {
  return buildScopedHref('/audit-events', projectId, environmentId, {
    category: 'project_environment',
    action: 'project_environment.resources.copy',
    targetType: 'project_environment',
  });
}

export function buildResourceControlHref(
  projectId: string,
  environmentId?: string | null,
  resourceId?: string | null,
): string {
  return buildScopedHref('/resource-control', projectId, environmentId, {
    ...(resourceId ? { resourceId } : {}),
  });
}

export function buildResourceMetricAlertHref(
  projectId: string,
  environmentId?: string | null,
  resourceId?: string | null,
): string {
  return buildScopedHref('/monitoring', projectId, environmentId, {
    targetKind: 'resource',
    templateId: 'resource-cpu-threshold',
    metric: 'resource_metric_threshold',
    ...(resourceId ? { resourceId } : {}),
  });
}

export function listEnvironmentManagedResources(
  resources: ProjectManagedResource[],
  environmentId: string,
): ProjectManagedResource[] {
  return resources.filter((resource) => resource.environment?.id === environmentId);
}
