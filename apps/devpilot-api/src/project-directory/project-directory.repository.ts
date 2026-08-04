import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { FROZEN_REPOSITORY_INTAKE_FINALIZATIONS_SELECT } from "../project-intake/repository-intake-summary.select";
import {
  type ProjectDirectoryActivityRecord,
  recentProjectActivity,
} from "./project-directory-activity.repository";

export const PROJECT_DIRECTORY_SELECT =
  Prisma.validator<Prisma.ProjectSelect>()({
    id: true,
    teamId: true,
    name: true,
    onboardingStatus: true,
    onboardingRevision: true,
    onboardingFinalizedAt: true,
    createdAt: true,
    updatedAt: true,
    repositoryIdentity: {
      select: {
        id: true,
        projectId: true,
        provider: true,
        canonicalKey: true,
        canonicalUrl: true,
        lockedAt: true,
        currentRevision: {
          select: {
            id: true,
            identityId: true,
            projectId: true,
            revision: true,
            defaultBranch: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    },
    repositoryConnection: {
      select: {
        provider: true,
        repositoryUrl: true,
        defaultBranch: true,
        selectedBranch: true,
        commitSha: true,
        status: true,
      },
    },
    intakeFinalizations: FROZEN_REPOSITORY_INTAKE_FINALIZATIONS_SELECT,
    environments: {
      where: { status: "active" },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        teamId: true,
        projectId: true,
        key: true,
        name: true,
        status: true,
        baselineRole: true,
        identityLockedAt: true,
        currentConfigRevisionId: true,
        currentEnvironmentVersionId: true,
        currentEnvironmentVersion: {
          select: {
            id: true,
            teamId: true,
            projectId: true,
            environmentId: true,
            releaseOrderId: true,
            artifactManifestId: true,
            deploymentRunId: true,
            effectiveAt: true,
            releaseOrder: {
              select: {
                id: true,
                teamId: true,
                projectId: true,
                releaseVersion: true,
              },
            },
            artifactManifest: {
              select: {
                id: true,
                teamId: true,
                projectId: true,
                releaseOrderId: true,
              },
            },
            deploymentRun: {
              select: {
                id: true,
                teamId: true,
                projectId: true,
                environmentId: true,
                artifactManifestId: true,
                source: true,
                status: true,
                dryRun: true,
              },
            },
          },
        },
      },
    },
    sites: {
      where: { status: "active" },
      orderBy: [{ primaryDomain: "asc" }, { id: "asc" }],
      select: {
        id: true,
        teamId: true,
        projectId: true,
        primaryDomain: true,
        status: true,
        environmentId: true,
      },
    },
  });

type ProjectDirectoryBaseRecord = Prisma.ProjectGetPayload<{
  select: typeof PROJECT_DIRECTORY_SELECT;
}>;
export type ProjectDirectoryRecord = ProjectDirectoryBaseRecord & {
  recentActivity: ProjectDirectoryActivityRecord;
};

@Injectable()
export class ProjectDirectoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(teamId: string): Promise<ProjectDirectoryRecord[]> {
    const [projects, activity] = await Promise.all([
      this.prisma.project.findMany({
        where: { teamId, archivedAt: null },
        orderBy: [{ id: "asc" }],
        select: PROJECT_DIRECTORY_SELECT,
      }),
      recentProjectActivity(this.prisma, teamId),
    ]);
    return projects.map((project) => ({
      ...project,
      recentActivity: activity.get(project.id) ?? {
        id: project.id,
        projectId: project.id,
        activityType: "project",
        status: project.onboardingStatus ?? "unknown",
        summary: null,
        occurredAt: project.updatedAt,
      },
    }));
  }
}
