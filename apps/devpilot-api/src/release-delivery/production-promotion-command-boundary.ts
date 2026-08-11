import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { FrozenProductionCandidate } from "./production-promotion-candidate.policy";
import type { ProductionPromotionResumeInput } from "./production-promotion-command.types";

export async function lockProductionPromotionRuns(
  tx: Prisma.TransactionClient,
  input: ProductionPromotionResumeInput,
) {
  await tx.$queryRaw`SELECT id FROM DeploymentRun WHERE id = ${input.deploymentRunId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM ReleaseRun WHERE id = ${input.releaseRunId} FOR UPDATE`;
}

export async function loadPromotionDeployment(
  tx: Prisma.TransactionClient,
  input: ProductionPromotionResumeInput,
) {
  const deployment = await tx.deploymentRun.findFirst({
    where: {
      id: input.deploymentRunId,
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      releaseRunId: input.releaseRunId,
    },
    select: {
      result: true,
      logs: true,
      artifactManifestId: true,
      adapterKey: true,
      projectEnvironment: {
        select: { status: true, baselineRole: true, currentConfigRevisionId: true },
      },
      artifactManifest: {
        select: { id: true, digest: true, buildRunId: true, releaseOrderId: true },
      },
      releaseRun: {
        select: {
          id: true, status: true, artifactManifestId: true, verifiedDigest: true,
          configRevisionId: true, inputHash: true, routeSnapshot: true,
          operationApprovalId: true,
        },
      },
    },
  });
  if (!deployment?.releaseRun || !deployment.artifactManifest) {
    throw new ConflictException("Production promotion 运行边界不存在或状态已变化");
  }
  return {
    ...deployment,
    releaseRun: deployment.releaseRun,
    artifactManifest: deployment.artifactManifest,
  };
}

export function assertPromotionCandidateState(
  deployment: Awaited<ReturnType<typeof loadPromotionDeployment>>,
  candidate: FrozenProductionCandidate,
) {
  const release = deployment.releaseRun;
  const manifest = deployment.artifactManifest;
  const environment = deployment.projectEnvironment;
  if (
    release.status !== "awaiting_validation" ||
    !environment || environment.status !== "active" ||
    environment.baselineRole !== "production" ||
    environment.currentConfigRevisionId !== candidate.configRevisionId ||
    release.configRevisionId !== candidate.configRevisionId ||
    release.artifactManifestId !== candidate.manifestId ||
    release.verifiedDigest !== candidate.manifestDigest ||
    deployment.artifactManifestId !== candidate.manifestId ||
    deployment.adapterKey !== candidate.providerKey ||
    manifest.id !== candidate.manifestId ||
    manifest.digest !== candidate.manifestDigest ||
    manifest.buildRunId !== candidate.buildRunId ||
    manifest.releaseOrderId !== candidate.releaseOrderId
  ) throw new ConflictException("Production promotion 冻结事实已漂移");
}

export async function assertPromotionApproval(
  tx: Prisma.TransactionClient,
  run: { operationApprovalId: string | null; inputHash: string },
  candidate: FrozenProductionCandidate,
) {
  if (!run.operationApprovalId) throw new ConflictException("Production 审批缺失");
  await tx.$queryRaw`SELECT id FROM OperationApproval
    WHERE id = ${run.operationApprovalId} FOR UPDATE`;
  const approval = await tx.operationApproval.findFirst({
    where: {
      id: run.operationApprovalId,
      teamId: candidate.teamId,
      projectId: candidate.projectId,
      environmentId: candidate.environmentId,
      category: "release",
      action: candidate.kind === "recovery"
        ? "project.release_order.deploy_production_recovery"
        : "project.release_order.deploy_production",
      targetType: "release_run",
      targetId: candidate.releaseRunId,
      status: "approved",
      consumedAt: null,
      inputHash: run.inputHash,
    },
    select: { expiresAt: true },
  });
  if (!approval || (approval.expiresAt && approval.expiresAt < new Date())) {
    throw new ConflictException("Production 审批已失效、消费或过期");
  }
}
