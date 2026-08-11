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

export const RELEASE_GATE_CHECKPOINTS = [
  "build_pre_execution",
  "build_post_execution",
  "staging_pre_execution",
  "production_pre_execution",
  "production_post_deploy",
  "production_promote",
  "production_promote_pre_route",
  "production_post_route",
] as const;

export type ReleaseGateCheckpoint =
  (typeof RELEASE_GATE_CHECKPOINTS)[number];

export type PersistedReleaseGateEvaluation = ReleaseGateEvaluation & {
  evaluationId: string;
  evaluationInputHash: string;
  definitionVersion: string;
  persistedStatus: PersistedGateStatus;
  persistedAt: string;
  waiver: unknown;
  waiverExpiresAt: string | null;
  manualApprovals: PersistedGateManualApproval[];
};

export type PersistedGateManualApproval = {
  id: string;
  evaluationInputHash: string;
  actionInputHash: string;
  requesterActorId: string;
  reviewerActorId: string;
  sourcePolicyRevisionId: string | null;
  sourcePolicySnapshotHash: string | null;
  sourceCommitSha: string | null;
  confirmedAt: string;
  expiresAt: string | null;
};

export type ReleaseGateDecisionTarget = {
  sourceResolution?: "unavailable";
  sourceBranch?: string;
  sourceCommitSha?: string;
  sourceEvidence?: import("./release-build-source-evidence.types").ReleaseBuildSourceEvidence;
  buildRunId?: string;
  manifestId?: string;
  releaseRunId?: string;
  deploymentRunId?: string;
  candidateHash?: string;
  environmentId?: string;
  configRevisionId?: string | null;
  /** Deployment provider key (ssh-v1 / local-filesystem-v1) so D07 gates
   *  evaluate the provider-matched binding — the same resolution the deploy
   *  path uses (AC-SET-022/023). */
  providerKey?: string;
  bindingId?: string;
  deploymentInputHash?: string;
  workloadInputHash?: string;
  workloadServiceCount?: number;
  workloadHealthConfigured?: boolean;
};

export type ReleaseGateDecisionInput = {
  target?: ReleaseGateDecisionTarget;
  actionInput: Record<string, string | null>;
};

export type ReleaseGateDecisionReference = {
  id: string;
  stage: ReleaseGateDecisionStage;
  inputHash: string;
  actionInputHash: string;
};

export type ReleaseGateDecisionSnapshot = {
  version: 3;
  stage: ReleaseGateDecisionStage;
  checkpoint: ReleaseGateCheckpoint;
  phase: ReleaseGatePhase;
  requiredGateIds: string[];
  actionInput: Record<string, string | null>;
  actionInputHash: string;
  requesterActorId: string;
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
    manualApprovals: PersistedGateManualApproval[];
  }>;
};

export type ReleaseGateDecisionDraft = {
  stage: ReleaseGateDecisionStage;
  checkpoint: ReleaseGateCheckpoint;
  phase: ReleaseGatePhase;
  actionInputHash: string;
  requesterActorId: string;
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
