import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { completeVersionedDeployment } from "./environment-version-write.utils";

const deploymentSelect = {
  id: true,
  environmentId: true,
  artifactManifestId: true,
  status: true,
  targetType: true,
  executorKey: true,
  adapterKey: true,
  dryRun: true,
  branch: true,
  commitSha: true,
  params: true,
  commandPlan: true,
  logs: true,
  result: true,
  error: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class ReleaseStagingRepository {
  constructor(private readonly prisma: PrismaService) {}

  context(teamId: string, projectId: string, releaseOrderId: string) {
    return this.prisma.releaseOrder.findFirst({
      where: { id: releaseOrderId, teamId, projectId },
      select: {
        id: true,
        project: {
          select: {
            environments: {
              where: { status: "active", baselineRole: "staging" },
              select: { id: true, name: true },
            },
          },
        },
      },
    });
  }

  manifest(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
    manifestId: string,
  ) {
    return this.prisma.artifactManifest.findFirst({
      where: { id: manifestId, teamId, projectId, releaseOrderId },
      include: {
        buildRun: {
          select: {
            id: true,
            status: true,
            sourceBranch: true,
            sourceCommitSha: true,
          },
        },
        items: { orderBy: { componentKey: "asc" } },
      },
    });
  }

  list(teamId: string, projectId: string, releaseOrderId: string) {
    return this.prisma.deploymentRun.findMany({
      where: {
        teamId,
        projectId,
        projectEnvironment: { baselineRole: "staging" },
        artifactManifest: { releaseOrderId },
        source: "release_order",
      },
      select: deploymentSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  create(input: {
    teamId: string;
    projectId: string;
    actorId: string;
    environmentId: string;
    manifestId: string;
    sourceBranch: string;
    sourceCommitSha: string;
    params: Record<string, unknown>;
  }) {
    return this.prisma.deploymentRun.create({
      data: {
        teamId: input.teamId,
        projectId: input.projectId,
        actorId: input.actorId,
        environmentId: input.environmentId,
        artifactManifestId: input.manifestId,
        environment: "staging",
        mode: "deploy",
        source: "release_order",
        trigger: "manual",
        targetType: "release-artifact",
        executorKey: "release-artifact",
        adapterKey: "local-materialize",
        dryRun: false,
        status: "running",
        branch: input.sourceBranch,
        commitSha: input.sourceCommitSha,
        params: input.params as Prisma.InputJsonValue,
        commandPlan: {
          version: 1,
          steps: ["verify_manifest_digest", "materialize_exact_artifact"],
          checkout: false,
          pull: false,
          build: false,
        },
      },
      select: deploymentSelect,
    });
  }

  finish(input: {
    deploymentRunId: string;
    status: "completed" | "failed";
    logs: string[];
    result?: Record<string, unknown>;
    error?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await completeVersionedDeployment(tx, { ...input, kind: "deploy" });
      return tx.deploymentRun.findUniqueOrThrow({
        where: { id: input.deploymentRunId },
        select: deploymentSelect,
      });
    });
  }
}
