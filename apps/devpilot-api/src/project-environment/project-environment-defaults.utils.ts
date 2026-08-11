/**
 * Pure helpers for the project-environment defaults-seeding service.
 *
 * Owns the per-key upsert payload shaping used by `ensureDefaultsForProject`.
 * Extracted to keep the defaults service under the file-size ceiling. Pure.
 */

import {
  environmentKeysFromConfig as environmentKeysFromConfigUtil,
  labelForKey as labelForKeyUtil,
  toJsonValue as toJsonValueUtil,
} from './project-environment-helpers.utils';

/**
 * Build the ordered list of environment keys to seed from a project config.
 * Falls back to the staging/production release baselines when none are declared.
 */
export function resolveSeedEnvironmentKeys(config: unknown): string[] {
  return environmentKeysFromConfigUtil(config);
}

/** Build the Prisma `upsertProjectEnvironment` args for one seeded key. */
export function buildSeedUpsertArgs(
  teamId: string,
  projectId: string,
  key: string,
  index: number,
) {
  const baselineRole = releaseBaselineRole(key);
  return {
    where: { projectId_key: { projectId, key } },
    create: {
      teamId,
      projectId,
      key,
      name: labelForKeyUtil(key),
      sortOrder: index * 10,
      baselineRole,
      config: toJsonValueUtil({
        source: 'project_config',
        initializedBy: 'ProjectEnvironmentService.ensureDefaultsForProject',
      }),
    },
    update: {
      name: labelForKeyUtil(key),
      sortOrder: index * 10,
    },
  };
}

function releaseBaselineRole(key: string) {
  return key === 'staging' || key === 'production' ? key : null;
}
