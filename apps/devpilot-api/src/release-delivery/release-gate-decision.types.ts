import type {
  ReleaseGateEvaluation,
  ReleaseGatePhase,
} from "./release-gate-catalog.types";
import type { PersistedGateStatus } from "./gate-evaluation-persistence.utils";

export const RELEASE_GATE_DECISION_STAGES = [
  "build",
  "staging",
  "production",
] as const;

export type ReleaseGateDecisionStage =
  (typeof RELEASE_GATE_DECISION_STAGES)[number];

export type PersistedReleaseGateEvaluation = ReleaseGateEvaluation & {
  evaluationId: string;
  evaluationInputHash: string;
  definitionVersion: string;
  persistedStatus: PersistedGateStatus;
  persistedAt: string;
  waiver: unknown;
  waiverExpiresAt: string | null;
};

export type ReleaseGateDecisionTarget = {
  sourceResolution?: "unavailable";
  sourceBranch?: string;
  sourceCommitSha?: string;
  buildRunId?: string;
  manifestId?: string;
  releaseRunId?: string;
  deploymentRunId?: string;
  environmentId?: string;
  configRevisionId?: string | null;
  /** Deployment provider key (ssh-v1 / local-filesystem-v1) so D07 gates
   *  evaluate the provider-matched binding — the same resolution the deploy
   *  path uses (AC-SET-022/023). */
  providerKey?: string;
  bindingId?: string;
  deploymentInputHash?: string;
};

export type ReleaseGateDecisionInput = {
  target?: ReleaseGateDecisionTarget;
  actionInput: Record<string, string | null>;
};

export type ReleaseGateDecisionReference = {
  id: string;
  stage: ReleaseGateDecisionStage;
  inputHash: string;
};

export type ReleaseGateDecisionSnapshot = {
  version: 1;
  stage: ReleaseGateDecisionStage;
  phase: ReleaseGatePhase;
  actionInput: Record<string, string | null>;
  evaluations: Array<{
    gateId: string;
    evaluationId: string;
    evaluationInputHash: string;
    status: string;
    providerKey: string | null;
    reasonCode: string;
    evidenceRef: string | null;
    checkedAt: string | null;
    expiresAt: string | null;
    fresh: boolean | null;
    waiver: unknown;
    waiverExpiresAt: string | null;
  }>;
};

export type ReleaseGateDecisionDraft = {
  stage: ReleaseGateDecisionStage;
  phase: ReleaseGatePhase;
  allowed: boolean;
  blockerGateIds: string[];
  manualGateIds: string[];
  confirmedManualGateIds: string[];
  warningGateIds: string[];
  deferredGateIds: string[];
  evidenceOnlyGateIds: string[];
  integrityErrors: string[];
  snapshot: ReleaseGateDecisionSnapshot;
};

export type ReleaseGateDecision = Omit<ReleaseGateDecisionDraft, "snapshot"> & {
  id: string;
  inputHash: string;
  decidedAt: string;
};
