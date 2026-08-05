import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { completeVersionedDeployment } from "./environment-version-write.utils";
import { lockActionableReleaseOrder } from "./release-order-action-boundary";
import { claimReleaseGateDecision } from "./release-gate-decision.repository";
import type { ReleaseGateDecisionReference } from "./release-gate-decision.types";
import { startProductionReleaseExecution } from "./environment-version-production-reservation-boundary";

@Injectable()
export class EnvironmentVersionRepository {
  constructor(private readonly prisma: PrismaService) {}

  environment(teamId: string, projectId: string, environmentId: string) {
    return this.prisma.projectEnvironment.findFirst({
      where: {
        id: environmentId,
        teamId,
        projectId,
        status: "active",
        baselineRole: { in: ["staging", "production"] },
      },
      select: {
        id: true,
        key: true,
        name: true,
        baselineRole: true,
        currentConfigRevisionId: true,
        currentEnvironmentVersionId: true,
      },
    });
  }

  sourceVersion(
    teamId: string,
    projectId: string,
    environmentId: string,
    versionId: string,
  ) {
    return this.prisma.environmentVersion.findFirst({
      where: { id: versionId, teamId, projectId, environmentId },
      select: { id: true, artifactManifestId: true },
    });
  }

  manifest(teamId: string, projectId: string, manifestId: string) {
    return this.prisma.artifactManifest.findFirst({
      where: { id: manifestId, teamId, projectId },
      include: {
        buildRun: {
          select: {
            id: true,
            status: true,
            sourceBranch: true,
            sourceCommitSha: true,
          },
        },
        items: true,
        deploymentRuns: {
          where: {
            source: "release_order",
            status: "completed",
            projectEnvironment: { baselineRole: "staging" },
          },
          select: { id: true, result: true },
        },
      },
    });
  }

  releaseRun(
    teamId: string,
    projectId: string,
    environmentId: string,
    runId: string,
  ) {
    return this.prisma.releaseRun.findFirst({
      where: { id: runId, teamId, projectId, environmentId },
      include: {
        operationApproval: true,
        environment: { select: { currentConfigRevisionId: true } },
      },
    });
  }

  reserve(input: {
    teamId: string;
    projectId: string;
    actorId: string;
    environmentId: string;
    configRevisionId: string | null;
    manifestId: string;
    releaseOrderId: string;
    releaseRunId?: string;
    mode: "deploy" | "rollback";
    branch: string;
    commitSha: string;
    params: Record<string, unknown>;
    gateDecision?: ReleaseGateDecisionReference;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await lockActionableReleaseOrder(tx, input);
      if (input.releaseRunId) {
        if (!input.gateDecision) {
          throw new ConflictException("Production 执行缺少已允许的门禁决定");
        }
        await startProductionReleaseExecution(tx, {
          teamId: input.teamId,
          projectId: input.projectId,
          releaseOrderId: input.releaseOrderId,
          environmentId: input.environmentId,
          configRevisionId: input.configRevisionId,
          manifestId: input.manifestId,
          releaseRunId: input.releaseRunId,
        });
      }
      const run = await tx.deploymentRun.create({
        data: {
          teamId: input.teamId,
          projectId: input.projectId,
          actorId: input.actorId,
          environmentId: input.environmentId,
          artifactManifestId: input.manifestId,
          releaseRunId: input.releaseRunId,
          mode: input.mode,
          source: "release_order",
          trigger: "manual",
          targetType: "release-artifact",
          executorKey: "release-artifact",
          adapterKey: "local-materialize",
          dryRun: false,
          status: "running",
          branch: input.branch,
          commitSha: input.commitSha,
          params: input.params as Prisma.InputJsonValue,
          commandPlan: {
            version: 1,
            steps: ["verify_manifest_digest", "materialize_exact_artifact"],
            checkout: false,
            pull: false,
            build: false,
          },
        },
      });
      if (input.gateDecision) {
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
      }
      return run;
    });
  }

  complete(
    input: Parameters<typeof completeVersionedDeployment>[1] & {
      teamId: string;
      projectId: string;
      releaseOrderId: string;
      actorId: string;
      gateDecision?: ReleaseGateDecisionReference;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const version = await completeVersionedDeployment(tx, input);
      const run = await tx.deploymentRun.findUniqueOrThrow({
        where: { id: input.deploymentRunId },
      });
      if (input.gateDecision) {
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
          requireAllowed: input.status === "completed",
        });
      }
      return { run, version };
    });
  }
}
