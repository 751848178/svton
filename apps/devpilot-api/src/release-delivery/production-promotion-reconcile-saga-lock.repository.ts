import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { FrozenProductionCandidate } from "./production-promotion-candidate.policy";
import type { ProductionPromotionReadback } from "./production-promotion-reconcile.types";

type Scope = { teamId: string; projectId: string; releaseRunId: string;
  deploymentRunId: string };
type LockedSaga = { id: string; operationId: string; providerKey: string; status: string };

export async function lockExactLegacyPromotionSaga(
  tx: Prisma.TransactionClient,
  scope: Scope,
  candidate: FrozenProductionCandidate,
  readback: ProductionPromotionReadback,
  outcome: "committed" | "not_switched",
) {
  const rows = await tx.$queryRaw<LockedSaga[]>(Prisma.sql`
    SELECT id, operationId, providerKey, status FROM SiteRouteSwitchRun
    WHERE teamId = ${scope.teamId} AND projectId = ${scope.projectId}
      AND environmentId = ${candidate.environmentId}
      AND releaseRunId = ${scope.releaseRunId}
      AND deploymentRunId = ${scope.deploymentRunId}
      AND targetRef = ${candidate.targetRef}
    FOR UPDATE`);
  const route = rows.length === 1 ? rows[0] : null;
  if (!route || route.operationId !== readback.operationId ||
    route.providerKey !== readback.providerKey) throw drift();
  if (outcome === "committed") {
    if (route.status !== "committed") throw drift();
    return route;
  }
  if (["compensated", "failed"].includes(route.status)) return route;
  if (route.status !== "prepared") throw drift();
  const changed = await tx.siteRouteSwitchRun.updateMany({
    where: { id: route.id, status: "prepared" },
    data: { status: "failed", reasonCode: "legacy_reconciled_not_switched",
      finishedAt: new Date() },
  });
  if (changed.count !== 1) throw drift();
  return { ...route, status: "failed" };
}

function drift() {
  return new ConflictException("Route saga 已漂移或无法唯一关联冻结候选");
}
