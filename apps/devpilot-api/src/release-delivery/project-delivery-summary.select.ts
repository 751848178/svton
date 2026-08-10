import { Prisma } from "@prisma/client";
import { FROZEN_REPOSITORY_INTAKE_FINALIZATIONS_SELECT } from "../project-intake/repository-intake-summary.select";

const SCOPED_RESOURCE_SELECT = {
  id: true,
  teamId: true,
  projectId: true,
  environmentId: true,
} as const;

export const PROJECT_DELIVERY_SUMMARY_SELECT =
  Prisma.validator<Prisma.ProjectSelect>()({
    id: true,
    teamId: true,
    name: true,
    repositoryIdentity: {
      select: {
        id: true,
        teamId: true,
        projectId: true,
        provider: true,
        canonicalKey: true,
        canonicalUrl: true,
        lockedAt: true,
        currentRevision: {
          select: {
            id: true,
            teamId: true,
            projectId: true,
            identityId: true,
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
        status: true,
      },
    },
    intakeFinalizations: FROZEN_REPOSITORY_INTAKE_FINALIZATIONS_SELECT,
    environments: {
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
        currentConfigRevision: {
          select: {
            id: true,
            teamId: true,
            projectId: true,
            environmentId: true,
          },
        },
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
                digest: true,
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
    resourceInstances: { select: SCOPED_RESOURCE_SELECT },
    managedResources: { select: SCOPED_RESOURCE_SELECT },
    secretKeys: { select: SCOPED_RESOURCE_SELECT },
    cdnConfigs: { select: SCOPED_RESOURCE_SELECT },
    sites: {
      select: {
        ...SCOPED_RESOURCE_SELECT,
        primaryDomain: true,
        status: true,
      },
    },
  });

export type ProjectDeliverySummaryRecord = Prisma.ProjectGetPayload<{
  select: typeof PROJECT_DELIVERY_SUMMARY_SELECT;
}>;
