import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
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
      select: {
        id: true,
        mode: true,
        status: true,
        artifactManifestId: true,
        verifiedDigest: true,
        configRevisionId: true,
        inputHash: true,
        resourceSnapshot: true,
        routeSnapshot: true,
        policySnapshot: true,
        operationApproval: true,
        environment: { select: { currentConfigRevisionId: true } },
      },
    });
  }

  recoverySourceVersionId(
    teamId: string,
    projectId: string,
    environmentId: string,
    releaseRunId: string,
  ) {
    return this.prisma.$queryRaw<Array<{ sourceVersionId: string | null }>>`
      SELECT rv.id AS sourceVersionId
      FROM EnvironmentVersion rv
      INNER JOIN ReleaseRun rr ON rr.sourceReleaseRunId = rv.releaseRunId
      WHERE rr.id = ${releaseRunId}
        AND rr.teamId = ${teamId}
        AND rr.projectId = ${projectId}
        AND rr.environmentId = ${environmentId}
        AND rr.mode = 'recovery'
        AND rv.teamId = ${teamId}
        AND rv.projectId = ${projectId}
        AND rv.environmentId = ${environmentId}
      LIMIT 1
    `.then((rows) => rows[0]?.sourceVersionId ?? null);
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
    providerKey?: string;
    gateDecision?: ReleaseGateDecisionReference;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await lockActionableReleaseOrder(tx, input);
      if (!input.providerKey) {
        throw new ConflictException("环境部署缺少 Deployment Provider");
      }
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
          adapterKey: input.providerKey,
          dryRun: false,
          status: "running",
          branch: input.branch,
          commitSha: input.commitSha,
          params: input.params as Prisma.InputJsonValue,
          commandPlan: {
            version: 1,
            steps: ["verify_manifest_digest", "deploy_exact_manifest"],
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

}
