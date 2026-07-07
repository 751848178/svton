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
 * Falls back to dev/test/staging/prod when the config declares none.
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
  return {
    where: { projectId_key: { projectId, key } },
    create: {
      teamId,
      projectId,
      key,
      name: labelForKeyUtil(key),
      sortOrder: index * 10,
      config: toJsonValueUtil({
        source: 'project_config',
        initializedBy: 'ProjectEnvironmentService.ensureDefaultsForProject',
      }),
    },
    update: {
      name: labelForKeyUtil(key),
      sortOrder: index * 10,
      status: 'active',
    },
  };
}
