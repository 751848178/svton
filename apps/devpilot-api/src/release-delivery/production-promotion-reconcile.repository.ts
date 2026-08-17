import { Injectable, NotFoundException } from "@nestjs/common";
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
import { resolveLegacyPromotionSaga } from "./production-promotion-legacy-saga.repository";
import { finalizeProductionPromotionReconcile,
  terminateLegacyPromotionBeforeProvider } from "./production-promotion-reconcile-finalizer.repository";

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
      const saga = await resolveLegacyPromotionSaga(tx, promotion, candidate);
      const inputHash = productionPromotionReconcileInputHash(input);
      const existing = await tx.productionPromotionReconcileCommand.findUnique({
        where: { promotionCommandId_idempotencyKey: {
          promotionCommandId: promotion.id, idempotencyKey: input.idempotencyKey,
        } },
      });
      if (existing) {
        assertReconcileReplay(existing.inputHash, inputHash);
        return prepared(existing, candidate, saga, existing.status === "running");
      }
      const route = saga.kind === "unique" ? saga : null;
      const audit = await tx.productionPromotionReconcileCommand.create({
        data: {
          teamId: promotion.teamId, projectId: promotion.projectId,
          releaseOrderId: promotion.releaseOrderId,
          releaseRunId: promotion.releaseRunId,
          deploymentRunId: promotion.deploymentRunId,
          promotionCommandId: promotion.id, actorId: input.actorId,
          idempotencyKey: input.idempotencyKey, inputHash,
          routeSwitchOperationId: route?.operationId ?? null,
          routeProviderKey: route?.providerKey,
        },
      });
      return prepared(audit, candidate, saga, true);
    });
  }

  convergeCommitted(id: string, readback: ProductionPromotionReadback) {
    return finalizeProductionPromotionReconcile(this.prisma, id, readback, "committed");
  }

  terminateNotSwitched(id: string, readback: ProductionPromotionReadback) {
    return finalizeProductionPromotionReconcile(this.prisma, id, readback, "not_switched");
  }

  terminateBeforeProvider(id: string) {
    return terminateLegacyPromotionBeforeProvider(this.prisma, id);
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

}

function prepared(audit: any, candidate: any,
  saga: Awaited<ReturnType<typeof resolveLegacyPromotionSaga>>,
  shouldInspect: boolean) {
  return { audit, candidate,
    routeSwitchOperationId: saga.kind === "unique" ? saga.operationId : null,
    routeProviderKey: saga.kind === "unique" ? saga.providerKey : null,
    sagaResolution: saga.kind, shouldInspect };
}

function json(value: Record<string, unknown>) { return value as Prisma.InputJsonValue; }
