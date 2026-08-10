import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { assertReleaseDeploymentInputCurrent } from "./release-deployment-input-freeze.policy";
import type { ReleaseDeploymentInputSnapshot } from "./release-deployment-input.types";
import { lockActionableReleaseOrder } from "./release-order-action-boundary";
import { claimReleaseGateDecision } from "./release-gate-decision.repository";
import type { ReleaseGateDecisionReference } from "./release-gate-decision.types";
import { releaseStagingDeploymentSelect as deploymentSelect } from "./release-staging-select";
import {
  completeReleaseStagingRun,
  CompleteReleaseStagingInput,
} from "./release-staging-completion.repository";
import { assertReleaseStagingWorkloadCurrent } from "./release-staging-workload-freeze.policy";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";

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
            teamId: true,
            projectId: true,
            releaseOrderId: true,
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
    providerKey?: string;
    deploymentInput?: ReleaseDeploymentInputSnapshot;
    workload?: ReleaseStagingWorkloadSnapshot;
    gateDecision?: ReleaseGateDecisionReference;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await lockActionableReleaseOrder(tx, input);
      if (!input.providerKey) {
        throw new ConflictException("Staging 部署缺少 Deployment Provider");
      }
      if (!input.deploymentInput) {
        throw new ConflictException("Staging 部署缺少冻结输入快照");
      }
      if (!input.workload) {
        throw new ConflictException("Staging 部署缺少工作负载快照");
      }
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
      await assertReleaseDeploymentInputCurrent(tx, {
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        providerKey: input.providerKey,
        snapshot: input.deploymentInput,
      });
      await assertReleaseStagingWorkloadCurrent(tx, {
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        manifestId: input.manifestId,
        snapshot: input.workload,
      });
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
          adapterKey: input.providerKey,
          healthCheckUrl: input.workload.services.find((item) => item.health)
            ?.health?.url,
          dryRun: false,
          status: "running",
          branch: input.sourceBranch,
          commitSha: input.sourceCommitSha,
          params: input.params as Prisma.InputJsonValue,
          commandPlan: {
            version: 1,
            steps: [
              "verify_manifest_digest",
              "materialize_exact_manifest",
              "start_workloads",
              "probe_workloads",
              "activate_release",
            ],
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

  finish(input: CompleteReleaseStagingInput) {
    return this.prisma.$transaction((tx) =>
      completeReleaseStagingRun(tx, input),
    );
  }
}
