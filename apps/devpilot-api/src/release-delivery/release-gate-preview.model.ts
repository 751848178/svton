import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { releaseGateCheckpointPolicy } from "./release-gate-checkpoint.policy";
import type { ReleaseGateEvaluation } from "./release-gate-catalog.types";
import type { ReleaseGateActionIdentity } from "./release-gate-action-identity.policy";
import type {
  ReleaseGateCheckpoint,
  ReleaseGatePreviewDecision,
} from "./release-gate-decision.types";

export function buildReleaseGatePreviewDecision(input: {
  checkpoint: ReleaseGateCheckpoint;
  checks: ReleaseGateEvaluation[];
  actionIdentity: ReleaseGateActionIdentity;
  now?: Date;
}): ReleaseGatePreviewDecision {
  const policy = releaseGateCheckpointPolicy(input.checkpoint);
  const required = new Set(policy.requiredGateIds);
  const definitions = RELEASE_GATE_DEFINITIONS.filter((item) =>
    required.has(item.id),
  );
  const byId = new Map(input.checks.map((check) => [check.id, check]));
  const blockerGateIds: string[] = [];
  const manualGateIds: string[] = [];
  const warningGateIds: string[] = [];
  const integrityErrors: string[] = [];
  const now = input.now ?? new Date();

  for (const definition of definitions) {
    const check = byId.get(definition.id);
    if (!check) {
      integrityErrors.push(`${definition.id}:missing`);
      continue;
    }
    if (!matchesDefinition(check, definition)) {
      integrityErrors.push(`${definition.id}:definition_drift`);
      continue;
    }
    if (check.status === "manual") {
      manualGateIds.push(check.id);
    } else if (!isFresh(check, now) || check.status !== "checked") {
      if (check.status === "warning") warningGateIds.push(check.id);
      else blockerGateIds.push(check.id);
    }
  }
  const preApprovalBlockerGateIds = blockerGateIds.filter(
    (gateId) => gateId !== "D13",
  );
  const preApprovalManualGateIds = manualGateIds.filter(
    (gateId) => gateId !== "D13",
  );
  return {
    previewOnly: true,
    stage: policy.stage,
    checkpoint: input.checkpoint,
    phase: policy.phase,
    approvalSubjectHash: input.actionIdentity.approvalSubjectHash,
    actionInputHash: input.actionIdentity.actionInputHash,
    allowed:
      integrityErrors.length === 0 &&
      blockerGateIds.length === 0 &&
      manualGateIds.length === 0,
    preApprovalAllowed:
      integrityErrors.length === 0 &&
      preApprovalBlockerGateIds.length === 0 &&
      preApprovalManualGateIds.length === 0,
    preApprovalBlockerGateIds,
    preApprovalManualGateIds,
    blockerGateIds,
    manualGateIds,
    warningGateIds,
    integrityErrors,
  };
}

function matchesDefinition(
  check: ReleaseGateEvaluation,
  definition: (typeof RELEASE_GATE_DEFINITIONS)[number],
) {
  return check.phase === definition.phase &&
    check.ordinal === definition.ordinal &&
    check.capabilityId === definition.capabilityId &&
    check.delivery === definition.delivery;
}

function isFresh(check: ReleaseGateEvaluation, now: Date) {
  return Boolean(
    check.providerKey &&
    check.fresh === true &&
    (!check.expiresAt || new Date(check.expiresAt).getTime() >= now.getTime()),
  );
}
