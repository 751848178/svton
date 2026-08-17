import type { PersistedReleaseGateEvaluation } from "./release-gate-decision.types";
import { hasRequiredManualApprovals } from "./release-gate-manual-approval.policy";

describe("release gate additive manual approvals", () => {
  const now = new Date("2026-08-11T08:00:00.000Z");
  const actionIdentity = {
    approvalSubjectHash: "subject-1",
    actionInputHash: "action-1",
    requesterActorId: "requester-1",
  };

  it("requires the frozen distinct reviewer threshold", () => {
    const check = c03();
    check.manualApprovals = [approval("reviewer-1")];
    expect(hasRequiredManualApprovals({ check, actionIdentity, now })).toBe(false);
    check.manualApprovals.push(approval("reviewer-2"));
    expect(hasRequiredManualApprovals({ check, actionIdentity, now })).toBe(true);
  });

  it.each([
    ["stale subject", { approvalSubjectHash: "stale" }],
    ["wrong requester", { requesterActorId: "other" }],
    ["stale policy", { sourcePolicySnapshotHash: "stale" }],
    ["expired", { expiresAt: "2026-08-10T08:00:00.000Z" }],
  ])("rejects %s approvals", (_label, change) => {
    const check = c03();
    check.manualApprovals = [
      { ...approval("reviewer-1"), ...change },
      approval("reviewer-2"),
    ];
    expect(hasRequiredManualApprovals({ check, actionIdentity, now })).toBe(false);
  });
});

function c03(): PersistedReleaseGateEvaluation {
  return {
    id: "C03", ordinal: 3, title: { zh: "", en: "" }, phase: "commit",
    capabilityId: "M01", delivery: "target", dispositions: ["block", "manual"],
    status: "manual", providerKey: "source-policy-v2", reasonCode: "manual",
    reason: { zh: "", en: "" }, evidenceRef: "evidence:1",
    checkedAt: "2026-08-11T07:00:00.000Z",
    expiresAt: "2026-08-12T07:00:00.000Z", fresh: true,
    evidenceIdentity: {
      requiredIndependentApprovals: 2,
      sourcePolicyRevisionId: "policy-1",
      sourcePolicySnapshotHash: "policy-hash",
      sourceCommitSha: "a".repeat(40),
    },
    evaluationId: "evaluation-1", evaluationInputHash: "evaluation-hash",
    definitionVersion: "v1", persistedStatus: "needs_human",
    persistedAt: "2026-08-11T07:00:00.000Z", waiver: null,
    waiverExpiresAt: null, manualApprovals: [],
  };
}

function approval(reviewerActorId: string) {
  return {
    id: `approval-${reviewerActorId}`, evaluationInputHash: "older-evaluation-hash",
    approvalSubjectHash: "subject-1",
    actionInputHash: "action-1", requesterActorId: "requester-1",
    reviewerActorId, sourcePolicyRevisionId: "policy-1",
    sourcePolicySnapshotHash: "policy-hash", sourceCommitSha: "a".repeat(40),
    confirmedAt: "2026-08-11T07:30:00.000Z",
    expiresAt: "2026-08-12T07:00:00.000Z",
  };
}
