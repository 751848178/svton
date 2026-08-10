import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  releaseEvidenceDeploymentSelect,
  releaseEvidenceManifestSelect,
} from "./release-order-evidence.prisma";
import { loadProductionEvidence } from "./release-order-evidence-production.repository";

@Injectable()
export class ReleaseOrderEvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
    take: number,
  ) {
    const buildWhere = { teamId, projectId, releaseOrderId };
    const stagingWhere = {
      teamId,
      projectId,
      source: "release_order",
      dryRun: false,
      projectEnvironment: { teamId, projectId, baselineRole: "staging" },
      artifactManifest: {
        teamId,
        projectId,
        releaseOrderId,
        buildRun: { teamId, projectId, releaseOrderId, status: "succeeded" },
      },
    } as const;
    return this.prisma.$transaction(
      async (tx) => {
        const [order, buildRuns, buildTotal, stagingRuns, stagingTotal] =
          await Promise.all([
            tx.releaseOrder.findFirst({
              where: { id: releaseOrderId, teamId, projectId },
              select: { id: true, teamId: true, projectId: true },
            }),
            tx.buildRun.findMany({
              where: buildWhere,
              select: {
                id: true,
                teamId: true,
                projectId: true,
                releaseOrderId: true,
                revision: true,
                sourceBranch: true,
                sourceCommitSha: true,
                status: true,
                errorCode: true,
                errorMessage: true,
                startedAt: true,
                finishedAt: true,
                createdAt: true,
                manifest: { select: releaseEvidenceManifestSelect },
              },
              orderBy: [{ revision: "desc" }, { id: "desc" }],
              take,
            }),
            tx.buildRun.count({ where: buildWhere }),
            tx.deploymentRun.findMany({
              where: stagingWhere,
              select: releaseEvidenceDeploymentSelect,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take,
            }),
            tx.deploymentRun.count({ where: stagingWhere }),
          ]);
        if (!order) return null;
        const production = await loadProductionEvidence(
          tx,
          { teamId, projectId, releaseOrderId },
          take,
        );
        return {
          order,
          buildRuns,
          buildTotal,
          stagingRuns,
          stagingTotal,
          ...production,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
