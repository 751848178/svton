import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ReleaseBuildInputSnapshot } from "./release-build.types";

const buildInclude = {
  manifest: { include: { items: { orderBy: { componentKey: "asc" as const } } } },
} as const;

@Injectable()
export class ReleaseBuildRepository {
  constructor(private readonly prisma: PrismaService) {}

  context(teamId: string, projectId: string, releaseOrderId: string) {
    return this.prisma.releaseOrder.findFirst({
      where: { id: releaseOrderId, teamId, projectId },
      select: {
        id: true,
        project: {
          select: {
            repositoryConnection: true,
            applications: {
              where: { status: "active" },
              orderBy: { id: "asc" },
              select: {
                id: true,
                name: true,
                repoPath: true,
                services: {
                  where: { status: "active" },
                  orderBy: { id: "asc" },
                  select: { id: true, name: true, deployConfig: true },
                },
              },
            },
          },
        },
      },
    });
  }

  list(teamId: string, projectId: string, releaseOrderId: string) {
    return this.prisma.buildRun.findMany({
      where: { teamId, projectId, releaseOrderId },
      include: buildInclude,
      orderBy: [{ revision: "desc" }, { id: "desc" }],
    });
  }

  reserve(input: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    actorId: string;
    snapshot: ReleaseBuildInputSnapshot;
    inputHash: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ReleaseOrder WHERE id = ${input.releaseOrderId} FOR UPDATE`;
      const latest = await tx.buildRun.findFirst({
        where: { releaseOrderId: input.releaseOrderId },
        orderBy: { revision: "desc" },
        select: { revision: true },
      });
      return tx.buildRun.create({
        data: {
          teamId: input.teamId,
          projectId: input.projectId,
          releaseOrderId: input.releaseOrderId,
          triggeredById: input.actorId,
          revision: (latest?.revision || 0) + 1,
          sourceBranch: input.snapshot.sourceBranch,
          sourceCommitSha: input.snapshot.sourceCommitSha,
          inputSnapshot: input.snapshot as unknown as Prisma.InputJsonValue,
          inputHash: input.inputHash,
          status: "running",
          startedAt: new Date(),
        },
        include: buildInclude,
      });
    });
  }

  succeed(input: {
    buildRunId: string;
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    digest: string;
    uri: string;
    sizeBytes: number;
    sourceBranch: string;
    sourceCommitSha: string;
    inputHash: string;
    logReference: string;
    logSummary: Record<string, unknown>;
    gateSummary: Record<string, unknown>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.buildRun.update({
        where: { id: input.buildRunId },
        data: {
          status: "succeeded",
          logReference: input.logReference,
          logSummary: input.logSummary as Prisma.InputJsonValue,
          gateSummary: input.gateSummary as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });
      await tx.artifactManifest.create({
        data: {
          teamId: input.teamId,
          projectId: input.projectId,
          releaseOrderId: input.releaseOrderId,
          buildRunId: input.buildRunId,
          digest: input.digest,
          provenance: {
            source: "release_build",
            immutable: true,
            sourceBranch: input.sourceBranch,
            sourceCommitSha: input.sourceCommitSha,
            inputHash: input.inputHash,
          },
          items: {
            create: [{
              componentKey: "project-bundle",
              artifactType: "zip",
              uri: input.uri,
              digest: input.digest,
              metadata: { sizeBytes: input.sizeBytes },
            }],
          },
        },
      });
      await tx.releaseOrder.update({
        where: { id: input.releaseOrderId },
        data: { status: "active" },
      });
      return tx.buildRun.findUniqueOrThrow({
        where: { id: input.buildRunId },
        include: buildInclude,
      });
    });
  }

  async fail(input: {
    buildRunId: string;
    code: string;
    message: string;
    logReference: string;
    logSummary: Record<string, unknown>;
    gateSummary: Record<string, unknown>;
  }) {
    return this.prisma.buildRun.update({
      where: { id: input.buildRunId },
      data: {
        status: "failed",
        errorCode: input.code,
        errorMessage: input.message,
        logReference: input.logReference,
        logSummary: input.logSummary as Prisma.InputJsonValue,
        gateSummary: input.gateSummary as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
      include: buildInclude,
    });
  }
}
