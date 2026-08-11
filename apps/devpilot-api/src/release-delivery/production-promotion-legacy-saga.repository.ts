import type { Prisma } from "@prisma/client";
import type { FrozenProductionCandidate } from "./production-promotion-candidate.policy";
import type { LegacyPromotionSagaResolution } from "./production-promotion-reconcile.types";

export async function resolveLegacyPromotionSaga(
  tx: Prisma.TransactionClient,
  promotion: {
    teamId: string; projectId: string; releaseRunId: string;
    deploymentRunId: string; phase: string; attemptCount: number;
    routeSwitchOperationId: string | null; legacyReconcileReason: string | null;
  },
  candidate: FrozenProductionCandidate,
): Promise<LegacyPromotionSagaResolution> {
  const sagas = await exactLegacyPromotionSagas(tx, promotion, candidate);
  if (sagas.length > 1) return { kind: "ambiguous" };
  if (sagas.length === 1) return { kind: "unique", ...sagas[0] };
  return safeBeforeProvider(promotion) ? { kind: "none_safe" } : { kind: "none_blocked" };
}

export function exactLegacyPromotionSagas(
  tx: Prisma.TransactionClient,
  promotion: {
    teamId: string; projectId: string; releaseRunId: string; deploymentRunId: string;
  },
  candidate: FrozenProductionCandidate,
) {
  return tx.siteRouteSwitchRun.findMany({
    where: {
      teamId: promotion.teamId,
      projectId: promotion.projectId,
      environmentId: candidate.environmentId,
      releaseRunId: promotion.releaseRunId,
      deploymentRunId: promotion.deploymentRunId,
      targetRef: candidate.targetRef,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 2,
    select: { operationId: true, providerKey: true },
  });
}

export function safeBeforeProvider(promotion: {
  phase: string; attemptCount: number; routeSwitchOperationId: string | null;
  legacyReconcileReason: string | null;
}) {
  return promotion.phase === "legacy_reconcile_required" &&
    promotion.attemptCount === 0 && promotion.routeSwitchOperationId === null &&
    promotion.legacyReconcileReason === "prepare_before_provider";
}
