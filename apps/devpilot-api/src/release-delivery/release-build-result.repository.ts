import { ConflictException, Inject, Injectable } from "@nestjs/common";
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  succeed(input: CompleteBuildInput) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.buildRun.updateMany({
        where: { id: input.buildRunId, status: "running" },
        data: {
          status: "succeeded",
          logReference: input.logReference,
          logSummary: input.logSummary as Prisma.InputJsonValue,
          gateSummary: input.gateSummary as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          "BuildRun 已由其他终态占用，不能写入 Manifest",
        );
      }
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
    status?: "failed" | "canceled";
  }) {
    return this.updateTerminal({
      ...input,
      status: input.status || "failed",
    });
  }

  cancelActive(buildRunId: string) {
    return this.updateTerminal({
      buildRunId,
      status: "canceled",
      code: "BUILD_COMMAND_CANCELED",
      message: "构建已取消",
      logReference: `build-log://${buildRunId}`,
      logSummary: { redacted: true, lines: [] },
      gateSummary: {
        build: { status: "failed" },
        action: "可重新创建 BuildRun。",
      },
      claimStatuses: ["queued", "running"],
    });
  }

  private async updateTerminal(input: {
    buildRunId: string;
    status: "failed" | "canceled";
    code: string;
    message: string;
    logReference: string;
    logSummary: Record<string, unknown>;
    gateSummary: Record<string, unknown>;
    claimStatuses?: Array<"queued" | "running">;
  }) {
    await this.prisma.buildRun.updateMany({
      where: {
        id: input.buildRunId,
        status: { in: input.claimStatuses || ["running"] },
      },
      data: {
        status: input.status,
        errorCode: input.code,
        errorMessage: input.message,
        logReference: input.logReference,
        logSummary: input.logSummary as Prisma.InputJsonValue,
        gateSummary: input.gateSummary as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
    return this.prisma.buildRun.findUniqueOrThrow({
      where: { id: input.buildRunId },
      include: releaseBuildInclude,
    });
  }
}
