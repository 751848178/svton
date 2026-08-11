import type { FrozenProductionCandidate } from "./production-promotion-candidate.policy";
import type { ProductionPromotionLease } from "./production-promotion-lease.policy";

export type ProductionPromotionResumeInput = {
  teamId: string;
  projectId: string;
  actorId: string;
  environmentId: string;
  releaseRunId: string;
  deploymentRunId: string;
  candidateHash: string;
  idempotencyKey: string;
};

export type ReservedProductionPromotionCommand = {
  command: {
    id: string;
    status: string;
    inputHash: string;
    result: unknown;
    errorCode: string | null;
    errorMessage: string | null;
    phase: string;
    preDecisionId: string | null;
    preDecisionInputHash: string | null;
    preDecisionActionHash: string | null;
    postDecisionId: string | null;
    postDecisionInputHash: string | null;
    postDecisionActionHash: string | null;
    routeSwitchOperationId: string | null;
  };
  candidate: FrozenProductionCandidate;
  routeSnapshot: unknown;
  deploymentResult: unknown;
  deploymentLogs: unknown;
  lease?: ProductionPromotionLease;
  shouldExecute: boolean;
  recovered: boolean;
};
