import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { hasVerifiedStagingProof } from "./environment-version-policy.service";

const versionInclude = {
  releaseOrder: { select: { id: true, releaseVersion: true } },
  artifactManifest: {
    select: {
      id: true,
      digest: true,
      buildRun: { select: { id: true, revision: true, sourceCommitSha: true } },
    },
  },
  deploymentRun: {
    select: { id: true, status: true, createdAt: true, finishedAt: true },
  },
} as const;

const exactCurrentVersionInclude = {
  select: {
    id: true,
    teamId: true,
    projectId: true,
    environmentId: true,
    releaseOrderId: true,
    artifactManifestId: true,
    deploymentRunId: true,
    releaseRunId: true,
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
        result: true,
      },
    },
    releaseRun: {
      select: {
        id: true, teamId: true, projectId: true, environmentId: true,
        releaseOrderId: true, artifactManifestId: true,
        status: true, verifiedDigest: true,
      },
    },
  },
} as const;

@Injectable()
export class EnvironmentVersionReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  environments(teamId: string, projectId: string) {
    return this.prisma.projectEnvironment.findMany({
      where: {
        teamId,
        projectId,
        status: "active",
        baselineRole: { in: ["staging", "production"] },
      },
      select: {
        id: true,
        teamId: true,
        projectId: true,
        key: true,
        name: true,
        baselineRole: true,
        currentEnvironmentVersionId: true,
        currentEnvironmentVersion: exactCurrentVersionInclude,
        environmentVersions: {
          include: versionInclude,
          orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
          take: 50,
        },
        releaseRuns: {
          where: {
            status: { in: ["awaiting_approval", "running", "awaiting_validation"] },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            id: true,
            mode: true,
            status: true,
            artifactManifestId: true,
            productionPromotionCommands: {
              where: { legacyReconcileRequired: true, status: "running" },
              orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
              select: { id: true, phase: true, legacyReconcileReason: true },
            },
            deploymentRuns: {
              where: { status: { in: ["running", "awaiting_validation"] } },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 1,
              select: { id: true, status: true, result: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { baselineRole: "desc" },
    });
  }

  async candidates(teamId: string, projectId: string) {
    const rows = await this.prisma.artifactManifest.findMany({
      where: {
        teamId,
        projectId,
        buildRun: { status: "succeeded" },
        releaseOrder: { status: { not: "canceled" } },
      },
      select: {
        id: true,
        digest: true,
        releaseOrder: { select: { id: true, releaseVersion: true } },
        buildRun: {
          select: { id: true, revision: true, sourceCommitSha: true },
        },
        deploymentRuns: {
          where: {
            source: "release_order",
            status: "completed",
            dryRun: false,
            projectEnvironment: { baselineRole: "staging" },
          },
          select: { id: true, result: true },
          take: 1,
        },
        releaseRuns: {
          where: {
            status: { in: ["awaiting_approval", "awaiting_validation"] },
            environment: { baselineRole: "production" },
          },
          select: {
            id: true,
            operationApproval: {
              select: { id: true, status: true, consumedAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      staging: rows,
      production: rows.filter(hasVerifiedStagingProof),
    };
  }
}
