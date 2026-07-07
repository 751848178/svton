/**
 * Project-environment sync-suggestions read service.
 *
 * Owns the cross-environment sync diff/suggestion read model:
 * `listSyncSuggestions` computes a read-only diff against a reference
 * environment, and `getSyncApplyAccessScope` resolves the apply access scope.
 * The apply orchestration lives in `ProjectEnvironmentSyncApplyService`.
 * Extracted from `ProjectEnvironmentService`. Behavior preserved verbatim.
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { EnvironmentSyncProfile } from './project-environment.service';
import {
  ListProjectEnvironmentSyncSuggestionsQueryDto,
} from './dto/project-environment.dto';
import {
  groupByEnvironment as groupByEnvironmentUtil,
} from './project-environment-helpers.utils';
import {
  buildDifferenceLabels as buildDifferenceLabelsUtil,
  buildSyncDifferences as buildSyncDifferencesUtil,
  buildSyncSuggestionActions as buildSyncSuggestionActionsUtil,
  emptySyncDifferences as emptySyncDifferencesUtil,
  findReferenceProfile as findReferenceProfileUtil,
} from './project-environment-sync-diff.utils';
import {
  buildEnvironmentSyncProfile,
  syncApplicationServicesArgs,
  syncCdnConfigsArgs,
  syncDeploymentRunsArgs,
  syncManagedResourcesArgs,
  syncResourceInstancesArgs,
  syncSecretKeysArgs,
  syncSitesArgs,
} from './project-environment-sync.utils';

@Injectable()
export class ProjectEnvironmentSyncService {
  constructor(
    private readonly repo: ProjectEnvironmentRepository,
  ) {}

  async listSyncSuggestions(
    teamId: string,
    query: ListProjectEnvironmentSyncSuggestionsQueryDto,
    readableEnvironmentIds?: string[],
  ) {
    if (!query.projectId) {
      throw new BadRequestException('projectId 不能为空');
    }

    const project = await this.assertProject(teamId, query.projectId);
    const readableIdSet = readableEnvironmentIds ? new Set(readableEnvironmentIds) : null;

    const environments = (await this.repo.findProjectEnvironments({
      where: {
        teamId,
        projectId: project.id,
        status: 'active',
        ...(readableIdSet ? { id: { in: [...readableIdSet] } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        serverBindings: {
          where: { status: 'active' },
          include: {
            server: { select: { id: true, name: true, host: true, status: true } },
          },
        },
      },
    }) as any);

    const environmentIds = environments.map((environment: any) => environment.id);
    if (environmentIds.length === 0) {
      return {
        projectId: project.id,
        referenceEnvironment: null,
        profiles: [],
        summary: {
          environmentCount: 0,
          actionCount: 0,
          differenceCount: 0,
        },
      };
    }

    const [
      services,
      deploymentRuns,
      sites,
      managedResources,
      resourceInstances,
      cdnConfigs,
      secretKeys,
    ] = (await Promise.all([
      this.repo.findApplicationServices(syncApplicationServicesArgs(teamId, project.id, environmentIds)),
      this.repo.findDeploymentRuns(syncDeploymentRunsArgs(teamId, project.id, environmentIds)),
      this.repo.findSites(syncSitesArgs(teamId, project.id, environmentIds)),
      this.repo.findManagedResources(syncManagedResourcesArgs(teamId, project.id, environmentIds)),
      this.repo.findResourceInstances(syncResourceInstancesArgs(teamId, project.id, environmentIds)),
      this.repo.findCDNConfigs(syncCdnConfigsArgs(teamId, project.id, environmentIds)),
      this.repo.findSecretKeys(syncSecretKeysArgs(teamId, project.id, environmentIds)),
    ])) as any;

    const servicesByEnvironment = groupByEnvironmentUtil(services as any[]) as any;
    const deploymentRunsByEnvironment = groupByEnvironmentUtil(deploymentRuns as any[]) as any;
    const sitesByEnvironment = groupByEnvironmentUtil(sites as any[]) as any;
    const managedResourcesByEnvironment = groupByEnvironmentUtil(managedResources as any[]) as any;
    const resourceInstancesByEnvironment = groupByEnvironmentUtil(resourceInstances as any[]) as any;
    const cdnConfigsByEnvironment = groupByEnvironmentUtil(cdnConfigs as any[]) as any;
    const secretKeysByEnvironment = groupByEnvironmentUtil(secretKeys as any[]) as any;

    const inventory = {
      services: servicesByEnvironment,
      deploymentRuns: deploymentRunsByEnvironment,
      sites: sitesByEnvironment,
      managedResources: managedResourcesByEnvironment,
      resourceInstances: resourceInstancesByEnvironment,
      cdnConfigs: cdnConfigsByEnvironment,
      secretKeys: secretKeysByEnvironment,
    };
    const baseProfiles: EnvironmentSyncProfile[] = environments.map((environment: any) =>
      buildEnvironmentSyncProfile(environment, inventory),
    );

    const reference = findReferenceProfileUtil(baseProfiles, query.referenceEnvironmentId);
    if (query.referenceEnvironmentId && !reference) {
      throw new BadRequestException('参考环境不存在或不可见');
    }

    const profiles = baseProfiles.map((profile) => {
      const isReference = Boolean(reference && profile.environment.id === reference.environment.id);
      const differences = reference
        ? buildSyncDifferencesUtil(profile, reference)
        : emptySyncDifferencesUtil();
      const actions = reference && !isReference
        ? buildSyncSuggestionActionsUtil(profile, reference, differences)
        : [];

      return {
        ...profile,
        isReference,
        differences,
        differenceLabels: isReference ? [] : buildDifferenceLabelsUtil(differences),
        actions,
      };
    });

    return {
      projectId: project.id,
      referenceEnvironment: reference?.environment || null,
      profiles,
      summary: {
        environmentCount: profiles.length,
        actionCount: profiles.reduce((sum, profile) => sum + profile.actions.length, 0),
        differenceCount: profiles.reduce((sum, profile) => sum + profile.differenceLabels.length, 0),
      },
    };
  }

  private async assertProject(teamId: string, projectId: string) {
    const project = await this.repo.findProject({
      where: { id: projectId, teamId },
      select: { id: true, config: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在或不属于当前团队');
    }

    return project;
  }
}
