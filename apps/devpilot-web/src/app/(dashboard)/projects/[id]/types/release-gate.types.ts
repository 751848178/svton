export type ReleaseGateStatus =
  | 'checked'
  | 'unchecked'
  | 'blocked'
  | 'warning'
  | 'manual'
  | 'unavailable';

export type ReleaseGatePhase = 'commit' | 'build' | 'deploy' | 'promote';
export type LocalizedGateText = { zh: string; en: string };
export type ReleaseGatePersistedStatus =
  | 'pending'
  | 'passed'
  | 'warning'
  | 'failed'
  | 'unavailable'
  | 'needs_human';

export type ReleaseGateCheck = {
  id: string;
  phase: ReleaseGatePhase;
  ordinal: number;
  title: LocalizedGateText;
  dispositions: string[];
  capabilityId: string | null;
  delivery: 'mvp' | 'target';
  status: ReleaseGateStatus;
  providerKey: string | null;
  reasonCode: string;
  reason: LocalizedGateText;
  evidenceRef: string | null;
  checkedAt: string | null;
  expiresAt: string | null;
  fresh: boolean | null;
  evaluationId: string;
  evaluationInputHash: string;
  definitionVersion: string;
  persistedStatus: ReleaseGatePersistedStatus;
  persistedAt: string;
  waiver: unknown;
  waiverExpiresAt: string | null;
};

export type ReleaseGateDecisionStage = 'build' | 'staging' | 'production';
export type ReleaseGateDecision = {
  id: string;
  stage: ReleaseGateDecisionStage;
  phase: Exclude<ReleaseGatePhase, 'promote'>;
  allowed: boolean;
  blockerGateIds: string[];
  manualGateIds: string[];
  confirmedManualGateIds: string[];
  warningGateIds: string[];
  deferredGateIds: string[];
  evidenceOnlyGateIds: string[];
  integrityErrors: string[];
  inputHash: string;
  decidedAt: string;
};

export type ReleaseDeploymentTargetReadiness = {
  environmentId: string | null;
  environmentKey: string | null;
  expectedProviderKey: string;
  bindingCount: number;
  matchState:
    | 'ready'
    | 'missing'
    | 'duplicated'
    | 'provider_mismatch'
    | 'ssh_root_invalid'
    | 'ssh_connection_invalid';
  reasonCode:
    | 'TARGET_READY'
    | 'TARGET_MISSING'
    | 'TARGET_DUPLICATED'
    | 'PROVIDER_MISMATCH'
    | 'SSH_ROOT_INVALID'
    | 'SSH_CONNECTION_INVALID';
  remediation: 'environment_targets' | null;
  currentTarget: null | {
    bindingId: string;
    serverId: string;
    providerKey: string;
    targetRef: string;
    root: string;
    server: { id: string; name: string; host: string; status: string };
  };
};

export type ReleaseGateCatalog = {
  catalogVersion: string;
  capabilityVersion: string;
  releaseOrder: { id: string; releaseVersion: string };
  summary: {
    total: number;
    phaseCounts: Record<ReleaseGatePhase, number>;
    statusCounts: Record<ReleaseGateStatus, number>;
  };
  decisions: Record<ReleaseGateDecisionStage, ReleaseGateDecision>;
  targetReadiness: ReleaseDeploymentTargetReadiness;
  capabilities: Array<{
    id: string;
    name: LocalizedGateText;
    available: boolean;
    providerKey: string | null;
    reasonCode: string;
    reason: LocalizedGateText;
  }>;
  checks: ReleaseGateCheck[];
};
