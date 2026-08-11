import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  assertReconcileReplay,
  exactLegacyPromotionCandidate,
  productionPromotionReconcileInputHash,
} from "./production-promotion-reconcile.policy";
import type {
  PreparedProductionPromotionReconcile,
  ProductionPromotionReadback,
  ProductionPromotionReconcileInput,
} from "./production-promotion-reconcile.types";

@Injectable()
export class ProductionPromotionReconcileRepository {
  constructor(private readonly prisma: PrismaService) {}

  prepare(input: ProductionPromotionReconcileInput) {
    return this.prisma.$transaction(async (tx): Promise<PreparedProductionPromotionReconcile> => {
      await tx.$queryRaw`SELECT id FROM ProductionPromotionCommand
        WHERE id = ${input.promotionCommandId} FOR UPDATE`;
      const promotion = await tx.productionPromotionCommand.findFirst({
        where: { id: input.promotionCommandId, teamId: input.teamId,
          projectId: input.projectId, status: "running", legacyReconcileRequired: true },
        include: { deploymentRun: { select: { environmentId: true, result: true } } },
      });
      if (!promotion) throw new NotFoundException("待核对的历史 promotion 不存在");
      const candidate = exactLegacyPromotionCandidate(promotion, input);
      const inputHash = productionPromotionReconcileInputHash(input);
      const existing = await tx.productionPromotionReconcileCommand.findUnique({
        where: { promotionCommandId_idempotencyKey: {
          promotionCommandId: promotion.id, idempotencyKey: input.idempotencyKey,
        } },
      });
      if (existing) {
        assertReconcileReplay(existing.inputHash, inputHash);
        return prepared(existing, candidate, existing.routeSwitchOperationId,
          existing.routeProviderKey, existing.status === "running");
      }
      const route = promotion.routeSwitchOperationId
        ? await tx.siteRouteSwitchRun.findFirst({
            where: { operationId: promotion.routeSwitchOperationId,
              releaseRunId: promotion.releaseRunId,
              deploymentRunId: promotion.deploymentRunId },
            select: { operationId: true, providerKey: true },
          }) : null;
      const audit = await tx.productionPromotionReconcileCommand.create({
        data: {
          teamId: promotion.teamId, projectId: promotion.projectId,
          releaseOrderId: promotion.releaseOrderId,
          releaseRunId: promotion.releaseRunId,
          deploymentRunId: promotion.deploymentRunId,
          promotionCommandId: promotion.id, actorId: input.actorId,
          idempotencyKey: input.idempotencyKey, inputHash,
          routeSwitchOperationId: route?.operationId ?? promotion.routeSwitchOperationId,
          routeProviderKey: route?.providerKey,
        },
      });
      return prepared(audit, candidate, audit.routeSwitchOperationId,
        audit.routeProviderKey, true);
    });
  }

  convergeCommitted(id: string, readback: ProductionPromotionReadback) {
    return this.finalize(id, readback, "committed");
  }

  terminateNotSwitched(id: string, readback: ProductionPromotionReadback) {
    return this.finalize(id, readback, "not_switched");
  }

  async block(id: string, readback: ProductionPromotionReadback, reason: string) {
    await this.prisma.productionPromotionReconcileCommand.updateMany({
      where: { id, status: "running" },
      data: { status: "blocked", readbackState: readback.state,
        errorCode: reason, errorMessage: "Provider readback 无法安全收敛历史 promotion",
        result: json({ operationId: readback.operationId,
          providerKey: readback.providerKey }), finishedAt: new Date() },
    });
    return this.prisma.productionPromotionReconcileCommand.findUniqueOrThrow({ where: { id } });
  }

  private finalize(
    id: string,
    readback: ProductionPromotionReadback,
    outcome: "committed" | "not_switched",
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockReconcile(tx, id);
      const audit = await loadReconcile(tx, id);
      assertReadback(audit, readback, outcome);
      const candidate = exactLegacyPromotionCandidate(
        audit.promotionCommand,
        { teamId: audit.teamId, projectId: audit.projectId,
          environmentId: audit.promotionCommand.deploymentRun.environmentId! },
      );
      const route = await tx.siteRouteSwitchRun.findFirst({
        where: { operationId: readback.operationId,
          providerKey: readback.providerKey!, releaseRunId: candidate.releaseRunId,
          deploymentRunId: candidate.deploymentRunId,
          targetRef: candidate.targetRef,
          status: outcome === "committed" ? "committed" : { in: ["prepared", "compensated", "failed"] } },
        select: { id: true },
      });
      if (!route) throw new ConflictException("Route readback 与冻结候选不一致");
      if (outcome === "committed") await assertCommittedBoundary(tx, audit, candidate);
      const now = new Date();
      await tx.productionPromotionCommand.update({ where: { id: audit.promotionCommandId },
        data: outcome === "committed" ? completedPromotion(now, id, readback)
          : terminatedPromotion(now, id, readback) });
      return tx.productionPromotionReconcileCommand.update({ where: { id }, data: {
        status: "completed", readbackState: readback.state,
        result: json({ outcome, operationId: readback.operationId,
          providerKey: readback.providerKey,
          retryAllowed: outcome === "not_switched" }), finishedAt: now,
      } });
    });
  }
}

function prepared(audit: any, candidate: any, routeSwitchOperationId: string | null,
  routeProviderKey: string | null, shouldInspect: boolean) {
  return { audit, candidate, routeSwitchOperationId, routeProviderKey, shouldInspect };
}

async function lockReconcile(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM ProductionPromotionReconcileCommand WHERE id = ${id} FOR UPDATE`;
  const row = await tx.productionPromotionReconcileCommand.findUnique({ where: { id }, select: { promotionCommandId: true } });
  if (!row) throw new NotFoundException("Promotion reconcile command 不存在");
  await tx.$queryRaw`SELECT id FROM ProductionPromotionCommand WHERE id = ${row.promotionCommandId} FOR UPDATE`;
}

function loadReconcile(tx: Prisma.TransactionClient, id: string) {
  return tx.productionPromotionReconcileCommand.findFirstOrThrow({
    where: { id, status: "running" },
    include: { promotionCommand: { include: {
      deploymentRun: { select: { environmentId: true, status: true, result: true,
        artifactManifestId: true, environmentVersion: { select: { id: true } } } },
      releaseRun: { select: { status: true, verifiedDigest: true,
        artifactManifestId: true, environmentId: true } },
    } } },
  });
}

function assertReadback(audit: Awaited<ReturnType<typeof loadReconcile>>,
  readback: ProductionPromotionReadback, outcome: string) {
  if (!audit.promotionCommand.legacyReconcileRequired ||
    audit.promotionCommand.status !== "running" || readback.state !== outcome ||
    !readback.providerKey || audit.routeSwitchOperationId !== readback.operationId ||
    audit.routeProviderKey !== readback.providerKey) {
    throw new ConflictException("Promotion reconcile readback 已漂移");
  }
}

async function assertCommittedBoundary(tx: Prisma.TransactionClient,
  audit: Awaited<ReturnType<typeof loadReconcile>>, candidate: any) {
  const promotion = audit.promotionCommand;
  const environment = await tx.projectEnvironment.findFirst({
    where: { id: candidate.environmentId, teamId: audit.teamId, projectId: audit.projectId },
    select: { currentEnvironmentVersionId: true },
  });
  if (promotion.deploymentRun.status !== "completed" ||
    promotion.releaseRun.status !== "succeeded" ||
    promotion.releaseRun.verifiedDigest !== candidate.manifestDigest ||
    promotion.releaseRun.artifactManifestId !== candidate.manifestId ||
    promotion.deploymentRun.artifactManifestId !== candidate.manifestId ||
    !promotion.deploymentRun.environmentVersion?.id ||
    environment?.currentEnvironmentVersionId !== promotion.deploymentRun.environmentVersion.id) {
    throw new ConflictException("Committed promotion 的版本指针或 digest 未通过复验");
  }
}

function completedPromotion(now: Date, reconcileId: string, readback: ProductionPromotionReadback) {
  return terminalPromotion(now, "completed", "committing", reconcileId, readback);
}
function terminatedPromotion(now: Date, reconcileId: string, readback: ProductionPromotionReadback) {
  return { ...terminalPromotion(now, "failed", "legacy_reconciled_not_switched", reconcileId, readback),
    errorCode: "LEGACY_PROMOTION_RECONCILED_NOT_SWITCHED",
    errorMessage: "Provider readback 证明旧候选未切换，可使用新幂等键重试" };
}
function terminalPromotion(now: Date, status: string, phase: string,
  reconcileId: string, readback: ProductionPromotionReadback) {
  return { status, phase, legacyReconcileRequired: false, legacyReconcileReason: null,
    leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null, finishedAt: now,
    result: json({ reconcileId, operationId: readback.operationId,
      providerKey: readback.providerKey, readbackState: readback.state }) };
}
function json(value: Record<string, unknown>) { return value as Prisma.InputJsonValue; }
