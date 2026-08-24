import type { ProjectEnvironment } from '../types';

/**
 * Return environments that have become part of the project's real operating
 * model. Legacy intake seeded every detected key as `project_config`; an empty
 * non-baseline seed is only a candidate and must not leak into project-local
 * configuration or domain selectors.
 */
export function selectExistingProjectEnvironments(
  environments: ProjectEnvironment[] = [],
): ProjectEnvironment[] {
  return environments.filter(
    (environment) => environment.status === 'active' && !isUnusedLegacySeed(environment),
  );
}

function isUnusedLegacySeed(environment: ProjectEnvironment) {
  if (!isProjectConfigSeed(environment.config)) return false;
  if (
    environment.baselineRole ||
    environment.currentConfigRevisionId ||
    environment.identityLockedAt
  ) {
    return false;
  }
  if ((environment.serverBindings?.length ?? 0) > 0) return false;
  return !Object.values(environment._count ?? {}).some((count) => count > 0);
}

function isProjectConfigSeed(config: ProjectEnvironment['config']) {
  return (
    config?.source === 'project_config' &&
    config?.initializedBy === 'ProjectEnvironmentService.ensureDefaultsForProject'
  );
}
