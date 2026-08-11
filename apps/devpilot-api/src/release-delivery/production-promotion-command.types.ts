import type { FrozenProductionCandidate } from "./production-promotion-candidate.policy";

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
  };
  candidate: FrozenProductionCandidate;
  routeSnapshot: unknown;
  deploymentResult: unknown;
  deploymentLogs: unknown;
  idempotentReplay: boolean;
};
