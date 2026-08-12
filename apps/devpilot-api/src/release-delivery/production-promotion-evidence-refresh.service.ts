import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseStagingExecutorPort } from "./release-staging.types";
import type { FrozenProductionCandidate } from "./production-promotion-candidate.policy";
import { localAcceptancePromotionEvidence } from "./release-local-promotion-evidence";
import { parseExactReleaseWorkloadSnapshot } from "./release-staging-workload-snapshot.policy";

@Injectable()
export class ProductionPromotionEvidenceRefreshService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: ReleaseStagingExecutorPort,
  ) {}

  async refresh(candidate: FrozenProductionCandidate) {
    if (this.executor.providerKey !== "local-filesystem-v1") return;
    const row = await this.prisma.deploymentRun.findFirst({
      where: {
        id: candidate.deploymentRunId,
        teamId: candidate.teamId,
        projectId: candidate.projectId,
        environmentId: candidate.environmentId,
        releaseRunId: candidate.releaseRunId,
        status: "awaiting_validation",
      },
      select: {
        params: true,
        result: true,
        artifactManifest: {
          select: { id: true, digest: true, deploymentRuns: {
            where: { status: "completed", source: "release_order",
              projectEnvironment: { baselineRole: "staging" } },
            select: { id: true, result: true },
          } },
        },
      },
    });
    const params = record(row?.params);
    const workload = parseExactReleaseWorkloadSnapshot(params.workload);
    if (!row?.artifactManifest || !workload ||
      workload.inputHash !== candidate.workloadInputHash ||
      workload.environmentId !== candidate.environmentId ||
      workload.manifestId !== candidate.manifestId ||
      workload.manifestDigest !== candidate.manifestDigest ||
      workload.services.length !== candidate.workloadServiceCount) return;
    const probe = await this.executor.refreshPromotionEvidence({
      projectId: candidate.projectId,
      environmentId: candidate.environmentId,
      deploymentRunId: candidate.deploymentRunId,
      workload,
    });
    if (!probe) return;
    const current = record(row.result);
    const promotion = localAcceptancePromotionEvidence({
      providerKey: this.executor.providerKey,
      observedAt: new Date(),
      manifest: row.artifactManifest,
      deploymentInputHash: candidate.deploymentInputHash,
      workloadInputHash: candidate.workloadInputHash,
      evidence: { ...current, ...probe },
    });
    if (!promotion) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM DeploymentRun
        WHERE id = ${candidate.deploymentRunId} FOR UPDATE`;
      const locked = await tx.deploymentRun.findFirst({
        where: { id: candidate.deploymentRunId, releaseRunId: candidate.releaseRunId,
          status: "awaiting_validation" },
        select: { result: true },
      });
      const result = record(locked?.result);
      if (record(result.productionCandidate).candidateHash !== candidate.candidateHash) return;
      await tx.deploymentRun.update({
        where: { id: candidate.deploymentRunId },
        data: { result: { ...result, ...probe, ...promotion } as Prisma.InputJsonValue },
      });
    });
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
