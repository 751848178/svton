/**
 * Project-environment defaults-seeding service.
 *
 * Owns `ensureDefaultsForProject`: seeds the dev/test/staging/prod (or
 * config-declared) environments for a project via Prisma upserts. Extracted
 * from `ProjectEnvironmentService`. Behavior preserved verbatim.
 */

import { Injectable } from '@nestjs/common';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { buildSeedUpsertArgs, resolveSeedEnvironmentKeys } from './project-environment-defaults.utils';

@Injectable()
export class ProjectEnvironmentDefaultsService {
  constructor(private readonly repo: ProjectEnvironmentRepository) {}

  async ensureDefaultsForProject(teamId: string, projectId: string, config: unknown) {
    const keys = resolveSeedEnvironmentKeys(config);
    for (const [index, key] of keys.entries()) {
      await this.repo.upsertProjectEnvironment(buildSeedUpsertArgs(teamId, projectId, key, index));
    }
  }
}
