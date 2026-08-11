import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { releaseGateCheckpointPolicy } from "./release-gate-checkpoint.policy";
import type {
  PersistedReleaseGateEvaluation,
  ReleaseGateCheckpoint,
  ReleaseGateDecisionDraft,
} from "./release-gate-decision.types";
import type { ReleaseGateActionIdentity } from "./release-gate-action-identity.policy";
import { hasRequiredManualApprovals } from "./release-gate-manual-approval.policy";
const EVIDENCE_ONLY_GATE_IDS = new Set(["P03"]);

export function buildReleaseGateDecision(input: {
  checkpoint: ReleaseGateCheckpoint;
  checks: PersistedReleaseGateEvaluation[];
  actionInput?: Record<string, string | null>;
  actionIdentity: ReleaseGateActionIdentity;
  now?: Date;
}): ReleaseGateDecisionDraft {
  const policy = releaseGateCheckpointPolicy(input.checkpoint);
  const requiredIds = new Set(policy.requiredGateIds);
  const definitions = RELEASE_GATE_DEFINITIONS.filter(
    (definition) => requiredIds.has(definition.id),
  );
  const byId = new Map<string, PersistedReleaseGateEvaluation[]>();
  for (const check of input.checks) {
    byId.set(check.id, [...(byId.get(check.id) ?? []), check]);
  }
  const blockerGateIds: string[] = [];
  const manualGateIds: string[] = [];
  const confirmedManualGateIds: string[] = [];
  const warningGateIds: string[] = [];
  const deferredGateIds: string[] = [];
  const integrityErrors: string[] = [];
  const requiredChecks: PersistedReleaseGateEvaluation[] = [];
  const now = input.now ?? new Date();

  for (const definition of definitions) {
    const candidates = byId.get(definition.id) ?? [];
    if (candidates.length !== 1) {
      integrityErrors.push(
        `${definition.id}:${candidates.length ? "duplicate" : "missing"}`,
      );
      continue;
    }
    const check = candidates[0];
    requiredChecks.push(check);
    if (!matchesDefinition(check, definition)) {
      integrityErrors.push(`${definition.id}:definition_drift`);
      continue;
    }
    if (check.status === "manual") {
      if (hasRequiredManualApprovals({
        check,
        actionIdentity: input.actionIdentity,
        now,
      }))
        confirmedManualGateIds.push(check.id);
      else if (definition.dispositions.includes("manual"))
        manualGateIds.push(check.id);
      else blockerGateIds.push(check.id);
      continue;
    }
    if (!isFreshProviderFact(check, now)) {
      blockerGateIds.push(check.id);
    } else if (check.status === "warning") {
      warningGateIds.push(check.id);
    } else if (check.status !== "checked") {
      blockerGateIds.push(check.id);
    }
  }

  return {
    stage: policy.stage,
    checkpoint: input.checkpoint,
    phase: policy.phase,
    approvalSubjectHash: input.actionIdentity.approvalSubjectHash,
    actionInputHash: input.actionIdentity.actionInputHash,
    requesterActorId: input.actionIdentity.requesterActorId,
    allowed:
      integrityErrors.length === 0 &&
      blockerGateIds.length === 0 &&
      manualGateIds.length === 0,
    blockerGateIds,
    manualGateIds,
    confirmedManualGateIds,
    warningGateIds,
    deferredGateIds,
    evidenceOnlyGateIds: input.checks
      .filter((check) => EVIDENCE_ONLY_GATE_IDS.has(check.id))
      .map((check) => check.id),
    integrityErrors,
    snapshot: {
      version: 4,
      stage: policy.stage,
      checkpoint: input.checkpoint,
      phase: policy.phase,
      requiredGateIds: [...policy.requiredGateIds],
      actionInput: input.actionInput ?? {},
      approvalSubjectHash: input.actionIdentity.approvalSubjectHash,
      actionInputHash: input.actionIdentity.actionInputHash,
      requesterActorId: input.actionIdentity.requesterActorId,
      evaluations: requiredChecks.map(snapshotEvaluation),
    },
  };
}

function matchesDefinition(
  check: PersistedReleaseGateEvaluation,
  definition: (typeof RELEASE_GATE_DEFINITIONS)[number],
) {
  return (
    check.phase === definition.phase &&
    check.ordinal === definition.ordinal &&
    check.capabilityId === definition.capabilityId &&
    check.delivery === definition.delivery &&
    check.dispositions.join() === definition.dispositions.join()
  );
}

function isFreshProviderFact(check: PersistedReleaseGateEvaluation, now: Date) {
  return Boolean(
    check.providerKey &&
    check.fresh === true &&
    (!check.expiresAt || new Date(check.expiresAt).getTime() >= now.getTime()),
  );
}

function snapshotEvaluation(check: PersistedReleaseGateEvaluation) {
  return {
    gateId: check.id,
    evaluationId: check.evaluationId,
    evaluationInputHash: check.evaluationInputHash,
    status: check.status,
    providerKey: check.providerKey,
    reasonCode: check.reasonCode,
    evidenceRef: check.evidenceRef,
    checkedAt: check.checkedAt,
    expiresAt: check.expiresAt,
    fresh: check.fresh,
    waiver: check.waiver,
    waiverExpiresAt: check.waiverExpiresAt,
    manualApprovals: check.manualApprovals,
  };
}
