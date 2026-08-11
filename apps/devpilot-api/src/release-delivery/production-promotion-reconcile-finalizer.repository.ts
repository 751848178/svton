import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { exactLegacyPromotionSagas, safeBeforeProvider } from "./production-promotion-legacy-saga.repository";
import { exactLegacyPromotionCandidate } from "./production-promotion-reconcile.policy";
import type { ProductionPromotionReadback } from "./production-promotion-reconcile.types";
import { lockExactLegacyPromotionSaga } from "./production-promotion-reconcile-saga-lock.repository";

export function finalizeProductionPromotionReconcile(
  prisma: PrismaService,
  id: string,
  readback: ProductionPromotionReadback,
  outcome: "committed" | "not_switched",
) {
  return prisma.$transaction(async (tx) => {
    const audit = await lockedReconcile(tx, id);
    assertReadback(audit, readback, outcome);
    const candidate = candidateFor(audit);
    await lockExactLegacyPromotionSaga(tx, audit, candidate, readback, outcome);
    if (outcome === "committed") await assertCommittedBoundary(tx, audit, candidate);
    const now = new Date();
    await tx.productionPromotionCommand.update({ where: { id: audit.promotionCommandId },
      data: outcome === "committed" ? completed(now, id, readback)
        : notSwitched(now, id, readback) });
    return tx.productionPromotionReconcileCommand.update({ where: { id }, data: {
      status: "completed", readbackState: readback.state,
      result: json({ outcome, operationId: readback.operationId,
        providerKey: readback.providerKey, retryAllowed: outcome === "not_switched" }),
      finishedAt: now,
    } });
  });
}

export function terminateLegacyPromotionBeforeProvider(prisma: PrismaService, id: string) {
  return prisma.$transaction(async (tx) => {
    const audit = await lockedReconcile(tx, id);
    const promotion = audit.promotionCommand;
    const candidate = candidateFor(audit);
    if (!safeBeforeProvider(promotion) ||
      (await exactLegacyPromotionSagas(tx, promotion, candidate)).length !== 0)
      throw new ConflictException("Promotion 已无法证明停留在 Provider 调用前");
    const now = new Date();
    await tx.productionPromotionCommand.update({ where: { id: promotion.id }, data: {
      status: "failed", phase: "legacy_reconciled_not_started",
      legacyReconcileRequired: false, legacyReconcileReason: null,
      leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null, finishedAt: now,
      errorCode: "LEGACY_PROMOTION_RECONCILED_NOT_STARTED",
      errorMessage: "持久化证明 Provider prepare 尚未开始，可使用新幂等键重试",
      result: json({ reconcileId: id, outcome: "not_started", retryAllowed: true }),
    } });
    return tx.productionPromotionReconcileCommand.update({ where: { id }, data: {
      status: "completed", readbackState: "not_started", finishedAt: now,
      result: json({ outcome: "not_started", retryAllowed: true }),
    } });
  });
}

async function lockedReconcile(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM ProductionPromotionReconcileCommand WHERE id = ${id} FOR UPDATE`;
  const row = await tx.productionPromotionReconcileCommand.findUnique({ where: { id },
    select: { promotionCommandId: true } });
  if (!row) throw new NotFoundException("Promotion reconcile command 不存在");
  await tx.$queryRaw`SELECT id FROM ProductionPromotionCommand
    WHERE id = ${row.promotionCommandId} FOR UPDATE`;
  return tx.productionPromotionReconcileCommand.findFirstOrThrow({
    where: { id, status: "running" }, include: { promotionCommand: { include: {
      deploymentRun: { select: { environmentId: true, status: true, result: true,
        artifactManifestId: true, environmentVersion: { select: { id: true } } } },
      releaseRun: { select: { status: true, verifiedDigest: true,
        artifactManifestId: true, environmentId: true } },
    } } },
  });
}

function candidateFor(audit: Awaited<ReturnType<typeof lockedReconcile>>) {
  return exactLegacyPromotionCandidate(audit.promotionCommand,
    { teamId: audit.teamId, projectId: audit.projectId,
      environmentId: audit.promotionCommand.deploymentRun.environmentId! });
}
function assertReadback(audit: Awaited<ReturnType<typeof lockedReconcile>>,
  readback: ProductionPromotionReadback, outcome: string) {
  if (!audit.promotionCommand.legacyReconcileRequired ||
    audit.promotionCommand.status !== "running" || readback.state !== outcome ||
    !readback.providerKey || audit.routeSwitchOperationId !== readback.operationId ||
    audit.routeProviderKey !== readback.providerKey)
    throw new ConflictException("Promotion reconcile readback 已漂移");
}
async function assertCommittedBoundary(tx: Prisma.TransactionClient,
  audit: Awaited<ReturnType<typeof lockedReconcile>>, candidate: any) {
  const promotion = audit.promotionCommand;
  const environment = await tx.projectEnvironment.findFirst({ where: {
    id: candidate.environmentId, teamId: audit.teamId, projectId: audit.projectId },
  select: { currentEnvironmentVersionId: true } });
  if (promotion.deploymentRun.status !== "completed" ||
    promotion.releaseRun.status !== "succeeded" ||
    promotion.releaseRun.verifiedDigest !== candidate.manifestDigest ||
    promotion.releaseRun.artifactManifestId !== candidate.manifestId ||
    promotion.deploymentRun.artifactManifestId !== candidate.manifestId ||
    !promotion.deploymentRun.environmentVersion?.id ||
    environment?.currentEnvironmentVersionId !== promotion.deploymentRun.environmentVersion.id)
    throw new ConflictException("Committed promotion 的版本指针或 digest 未通过复验");
}
function completed(now: Date, id: string, readback: ProductionPromotionReadback) {
  return terminal(now, "completed", "committing", id, readback);
}
function notSwitched(now: Date, id: string, readback: ProductionPromotionReadback) {
  return { ...terminal(now, "failed", "legacy_reconciled_not_switched", id, readback),
    errorCode: "LEGACY_PROMOTION_RECONCILED_NOT_SWITCHED",
    errorMessage: "Provider readback 证明旧候选未切换，可使用新幂等键重试" };
}
function terminal(now: Date, status: string, phase: string, id: string,
  readback: ProductionPromotionReadback) {
  return { status, phase, legacyReconcileRequired: false, legacyReconcileReason: null,
    leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null, finishedAt: now,
    result: json({ reconcileId: id, operationId: readback.operationId,
      providerKey: readback.providerKey, readbackState: readback.state }) };
}
function json(value: Record<string, unknown>) { return value as Prisma.InputJsonValue; }
