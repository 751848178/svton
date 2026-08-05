import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { completeVersionedDeployment } from "./environment-version-write.utils";
import { lockActionableReleaseOrder } from "./release-order-action-boundary";
import { claimReleaseGateDecision } from "./release-gate-decision.repository";
import type { ReleaseGateDecisionReference } from "./release-gate-decision.types";

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
              select: { id: true, name: true, currentConfigRevisionId: true },
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
    releaseOrderId: string;
    actorId: string;
    environmentId: string;
    configRevisionId: string | null;
    manifestId: string;
    sourceBranch: string;
    sourceCommitSha: string;
    params: Record<string, unknown>;
    gateDecision?: ReleaseGateDecisionReference;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await lockActionableReleaseOrder(tx, input);
      if (!input.gateDecision) {
        throw new ConflictException("Staging 部署缺少已允许的门禁决定");
      }
      await tx.$queryRaw`SELECT id FROM ProjectEnvironment WHERE id = ${input.environmentId} FOR UPDATE`;
      const environment = await tx.projectEnvironment.findFirst({
        where: {
          id: input.environmentId,
          teamId: input.teamId,
          projectId: input.projectId,
          status: "active",
          baselineRole: "staging",
          currentConfigRevisionId: input.configRevisionId,
        },
        select: { id: true },
      });
      if (!environment) {
        throw new ConflictException(
          "Staging 环境或配置修订已漂移，请重新检查门禁",
        );
      }
      const run = await tx.deploymentRun.create({
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
      await claimReleaseGateDecision(tx, {
        teamId: input.teamId,
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        actorId: input.actorId,
        decisionId: input.gateDecision.id,
        stage: input.gateDecision.stage,
        inputHash: input.gateDecision.inputHash,
        actionRunType: "deployment_run",
        actionRunId: run.id,
        requireAllowed: true,
      });
      return run;
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
