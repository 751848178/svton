import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { releaseBuildInclude } from "./release-build.prisma";

interface CompleteBuildInput {
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
  repositoryIdentityId: string;
  repositoryIdentityRevisionId: string;
  repositoryProvider: string;
  canonicalRepositoryUrl: string;
  logReference: string;
  logSummary: Record<string, unknown>;
  gateSummary: Record<string, unknown>;
}

@Injectable()
export class ReleaseBuildResultRepository {
  constructor(private readonly prisma: PrismaService) {}

  succeed(input: CompleteBuildInput) {
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
            repositoryIdentityId: input.repositoryIdentityId,
            repositoryIdentityRevisionId: input.repositoryIdentityRevisionId,
            repositoryProvider: input.repositoryProvider,
            canonicalRepositoryUrl: input.canonicalRepositoryUrl,
            inputHash: input.inputHash,
          },
          items: {
            create: [
              {
                componentKey: "project-bundle",
                artifactType: "zip",
                uri: input.uri,
                digest: input.digest,
                metadata: { sizeBytes: input.sizeBytes },
              },
            ],
          },
        },
      });
      await tx.releaseOrder.updateMany({
        where: { id: input.releaseOrderId, status: { not: "canceled" } },
        data: { status: "active" },
      });
      return tx.buildRun.findUniqueOrThrow({
        where: { id: input.buildRunId },
        include: releaseBuildInclude,
      });
    });
  }

  fail(input: {
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
      include: releaseBuildInclude,
    });
  }
}
