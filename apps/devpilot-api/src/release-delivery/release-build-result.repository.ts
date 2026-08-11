import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { assertReproducibleArtifact } from "./release-build-reproducibility.repository";
import { canceledBuildLogSummary } from "./release-build-terminal-evidence";
import type { ReleaseBuildArtifactItem } from "./release-build.types";
import { createReleaseBuildManifest } from "./release-build-manifest.writer";
import type { ReleaseGateDecisionReference } from "./release-gate-decision.types";
import { claimReleaseGateDecision } from "./release-gate-decision.repository";
import { releaseBuildInclude } from "./release-build.prisma";
import { lockActionableReleaseOrder } from "./release-order-action-boundary";
import { assertBuildDependencyStoreSucceeded } from "./release-build-dependency-invariant";

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
  actorId: string;
  gateDecision: ReleaseGateDecisionReference;
}

@Injectable()
export class ReleaseBuildResultRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  succeed(input: CompleteBuildInput) {
    return this.prisma.$transaction(async (tx) => {
      await lockActionableReleaseOrder(tx, input);
      await tx.$queryRaw`SELECT id FROM Project WHERE id = ${input.projectId} FOR UPDATE`;
      await assertBuildDependencyStoreSucceeded(tx, input.buildRunId);
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
      await claimReleaseGateDecision(tx, {
        teamId: input.teamId,
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        actorId: input.actorId,
        decisionId: input.gateDecision.id,
        stage: input.gateDecision.stage,
        inputHash: input.gateDecision.inputHash,
        actionRunType: "build_run_post_gate",
        actionRunId: input.buildRunId,
        requireAllowed: true,
      });
      await createReleaseBuildManifest(tx, input, prior?.id ?? null);
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

  async recordCandidateEvidence(input: {
    buildRunId: string;
    logReference: string;
    logSummary: Record<string, unknown>;
    gateSummary: Record<string, unknown>;
  }) {
    const claimed = await this.prisma.buildRun.updateMany({
      where: { id: input.buildRunId, status: "running" },
      data: {
        logReference: input.logReference,
        logSummary: input.logSummary as Prisma.InputJsonValue,
        gateSummary: input.gateSummary as Prisma.InputJsonValue,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException("BuildRun 已进入终态，不能写入候选门禁证据");
    }
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
