import type { ExactSiteRouteSagaReadback } from "../site/site-route-switch-saga-readback.service";
import type { FrozenProductionCandidate } from "./production-promotion-candidate.policy";

export type ProductionPromotionReconcileInput = {
  teamId: string;
  projectId: string;
  environmentId: string;
  actorId: string;
  promotionCommandId: string;
  idempotencyKey: string;
};

export type PreparedProductionPromotionReconcile = {
  audit: { id: string; status: string; inputHash: string };
  candidate: FrozenProductionCandidate;
  routeSwitchOperationId: string | null;
  routeProviderKey: string | null;
  shouldInspect: boolean;
};

export type ProductionPromotionReadback = ExactSiteRouteSagaReadback;
