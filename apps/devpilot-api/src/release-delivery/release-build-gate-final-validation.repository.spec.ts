import { GATE_DEFINITION_VERSION } from "./gate-evaluation-persistence.utils";
import { releaseGateActionIdentity } from "./release-gate-action-identity.policy";
import { assertBuildGateDecisionCurrent } from "./release-build-gate-final-validation.repository";

describe("build reserve final gate validation", () => {
  it("accepts the exact current policy after two independent reviewers", async () => {
    const fixture = setup();
    await expect(assertBuildGateDecisionCurrent(
      fixture.tx as never,
      fixture.input as never,
    )).resolves.toBeUndefined();
  });

  it("rejects insufficient reviewer count before BuildRun creation", async () => {
    const fixture = setup();
    fixture.approvals.pop();
    await expect(assertBuildGateDecisionCurrent(
      fixture.tx as never,
      fixture.input as never,
    )).rejects.toMatchObject({ status: 409 });
  });

  it("rejects policy and action drift at final reserve", async () => {
    const policyDrift = setup();
    policyDrift.tx.project.findUniqueOrThrow.mockResolvedValue({
      currentSourcePolicyRevisionId: "policy-new",
    });
    await expect(assertBuildGateDecisionCurrent(
      policyDrift.tx as never,
      policyDrift.input as never,
    )).rejects.toMatchObject({ status: 409 });

    const actionDrift = setup();
    actionDrift.input.snapshot.gateDecision.actionInputHash = "stale";
    await expect(assertBuildGateDecisionCurrent(
      actionDrift.tx as never,
      actionDrift.input as never,
    )).rejects.toMatchObject({ status: 409 });
  });
});

function setup() {
  const actionInput = {
    repositoryIdentityRevisionId: "revision-1",
    sourceBranch: "main",
    sourceCommitSha: "a".repeat(40),
  };
  const action = releaseGateActionIdentity({
    checkpoint: "build_pre_execution",
    actionInput,
    requesterActorId: "requester-1",
  });
  const gateIds = ["C01", "C02", "C03", "C05", "C06", "C08"];
  const rows = gateIds.map((gateId) => gateRow(gateId, action));
  const decision = {
    inputSnapshot: {
      version: 4,
      checkpoint: "build_pre_execution",
      requesterActorId: "requester-1",
      approvalSubjectHash: action.approvalSubjectHash,
      actionInputHash: action.actionInputHash,
      requiredGateIds: gateIds,
      actionInput,
      evaluations: rows.map((row) => ({
        gateId: row.gateId,
        evaluationId: row.id,
        evaluationInputHash: row.inputHash,
      })),
    },
  };
  const approvals = rows.flatMap((row) => row.manualApprovals.map((item) => ({
    ...item,
    gateEvaluation: { gateId: row.gateId },
  })));
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: "decision-1" }]),
    releaseGateDecision: { findFirst: jest.fn().mockResolvedValue(decision) },
    gateEvaluation: { findMany: jest.fn().mockResolvedValue(rows) },
    gateManualApproval: { findMany: jest.fn().mockImplementation(() => approvals) },
    project: { findUniqueOrThrow: jest.fn().mockResolvedValue({
      currentSourcePolicyRevisionId: "policy-1",
    }) },
    sourcePolicyRevision: { findFirst: jest.fn().mockResolvedValue({
      id: "policy-1", requiredIndependentApprovals: 2,
    }) },
  };
  return {
    tx,
    rows,
    approvals,
    input: {
      teamId: "team-1", projectId: "project-1",
      releaseOrderId: "order-1", actorId: "requester-1",
      snapshot: {
        version: 2, repositoryUrl: "https://example.test/repo.git",
        repositoryIdentity: {
          id: "identity-1", revisionId: "revision-1", revision: 1,
          provider: "generic", canonicalUrl: "https://example.test/repo",
        },
        sourceBranch: "main", sourceCommitSha: "a".repeat(40), components: [],
        gateDecision: {
          id: "decision-1", stage: "build", inputHash: "decision-hash",
          actionInputHash: action.actionInputHash,
        },
      },
    },
  };
}

function gateRow(
  gateId: string,
  action: {
    approvalSubjectHash: string; actionInputHash: string; requesterActorId: string;
  },
) {
  const manual = gateId === "C03";
  return {
    id: `evaluation-${gateId}`, gateId, inputHash: `hash-${gateId}`,
    definitionVersion: GATE_DEFINITION_VERSION,
    providerKey: "provider-v1", expiresAt: new Date("2099-08-12T00:00:00Z"),
    status: manual ? "needs_human" : "passed",
    summary: manual ? {
      decisionIdentity: { checkpoint: "build_pre_execution", ...action },
      evidenceIdentity: {
        requiredIndependentApprovals: 2,
        sourcePolicyRevisionId: "policy-1",
        sourcePolicySnapshotHash: "policy-hash",
        sourceCommitSha: "a".repeat(40),
      },
    } : {},
    manualApprovals: manual
      ? [approval("reviewer-1", action), approval("reviewer-2", action)] : [],
  };
}

function approval(
  reviewerActorId: string,
  action: {
    approvalSubjectHash: string; actionInputHash: string; requesterActorId: string;
  },
) {
  return {
    evaluationInputHash: "hash-C03", ...action, reviewerActorId,
    sourcePolicyRevisionId: "policy-1",
    sourcePolicySnapshotHash: "policy-hash", sourceCommitSha: "a".repeat(40),
    expiresAt: new Date("2099-08-12T00:00:00Z"),
  };
}
