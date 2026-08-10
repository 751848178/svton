import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { assertReproducibleArtifact } from "./release-build-reproducibility.repository";
import { canceledBuildLogSummary } from "./release-build-terminal-evidence";
import type { ReleaseBuildArtifactItem } from "./release-build.types";
import { releaseBuildInclude } from "./release-build.prisma";
import { lockActionableReleaseOrder } from "./release-order-action-boundary";

interface CompleteBuildInput {
  buildRunId: string;
  teamId: string;
  projectId: string;
  releaseOrderId: string;
  digest: string;
  uri: string;
  sizeBytes: number;
  items: ReleaseBuildArtifactItem[];
  contentIndex: Array<{ path: string; digest: string; sizeBytes: number }>;
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
      await lockActionableReleaseOrder(tx, input);
      await tx.$queryRaw`SELECT id FROM Project WHERE id = ${input.projectId} FOR UPDATE`;
      const prior = await assertReproducibleArtifact(tx, input);
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
            artifactContractVersion: 1,
            collection: "declared-outputs-only",
            reproducibility: prior
              ? { status: "matched", priorManifestId: prior.id }
              : { status: "baseline" },
            contentIndex: input.contentIndex,
            componentEnvironments: input.items.map((item) => ({
              componentKey: item.componentKey,
              ...item.environment,
            })),
          },
          items: {
            create: [
              {
                componentKey: "project-bundle",
                artifactType: "zip",
                uri: input.uri,
                digest: input.digest,
                metadata: {
                  sizeBytes: input.sizeBytes,
                  contentIndex: input.contentIndex,
                  provenance: {
                    sourceCommitSha: input.sourceCommitSha,
                    inputHash: input.inputHash,
                  },
                },
              },
              ...input.items.map((item) => ({
                componentKey: item.componentKey,
                artifactType: item.artifactType,
                uri: item.uri,
                digest: item.digest,
                metadata: {
                  sizeBytes: item.sizeBytes,
                  outputs: item.outputs,
                  contentIndex: item.contentIndex,
                  environment: item.environment,
                  provenance: {
                    sourceCommitSha: input.sourceCommitSha,
                    inputHash: input.inputHash,
                  },
                },
              })),
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

  async hasCommittedArtifact(input: { buildRunId: string; digest: string }) {
    const run = await this.prisma.buildRun.findUnique({
      where: { id: input.buildRunId },
      select: { status: true, manifest: { select: { digest: true } } },
    });
    return run?.status === "succeeded" && run.manifest?.digest === input.digest;
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
      logSummary: canceledBuildLogSummary(),
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
