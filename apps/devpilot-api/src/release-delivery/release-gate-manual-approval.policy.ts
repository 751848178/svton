import type { ReleaseGateActionIdentity } from "./release-gate-action-identity.policy";
import type { PersistedReleaseGateEvaluation } from "./release-gate-decision.types";

export function hasRequiredManualApprovals(input: {
  check: PersistedReleaseGateEvaluation;
  actionIdentity: ReleaseGateActionIdentity;
  now: Date;
}) {
  if (
    !input.check.dispositions.includes("manual") ||
    !freshProviderFact(input.check, input.now)
  ) return false;
  const evidence = record(input.check.evidenceIdentity);
  const required = input.check.id === "C03"
    ? positiveInteger(evidence.requiredIndependentApprovals)
    : 1;
  if (!required) return false;
  const reviewers = new Set<string>();
  for (const approval of input.check.manualApprovals) {
    if (
      approval.approvalSubjectHash !== input.actionIdentity.approvalSubjectHash ||
      approval.requesterActorId !== input.actionIdentity.requesterActorId ||
      approval.reviewerActorId === input.actionIdentity.requesterActorId ||
      (approval.expiresAt &&
        new Date(approval.expiresAt).getTime() < input.now.getTime()) ||
      !matchesSourceIdentity(input.check.id, approval, evidence)
    ) continue;
    reviewers.add(approval.reviewerActorId);
  }
  return reviewers.size >= required;
}

function matchesSourceIdentity(
  gateId: string,
  approval: PersistedReleaseGateEvaluation["manualApprovals"][number],
  evidence: Record<string, unknown>,
) {
  if (gateId !== "C03") return true;
  return (
    approval.sourcePolicyRevisionId === evidence.sourcePolicyRevisionId &&
    approval.sourcePolicySnapshotHash === evidence.sourcePolicySnapshotHash &&
    approval.sourceCommitSha === evidence.sourceCommitSha
  );
}

function freshProviderFact(check: PersistedReleaseGateEvaluation, now: Date) {
  return Boolean(
    check.providerKey &&
    check.fresh === true &&
    (!check.expiresAt || new Date(check.expiresAt).getTime() >= now.getTime()),
  );
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
