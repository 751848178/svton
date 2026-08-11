import { GateEvaluationRepository } from "./gate-evaluation.repository";

describe("GateEvaluationRepository C03 independent approval", () => {
  const row = {
    id: "evaluation-1",
    teamId: "team-1",
    projectId: "project-1",
    releaseOrderId: "order-1",
    gateId: "C03",
    status: "needs_human",
    providerKey: "repository_commit_analysis",
    actorId: "requester-1",
    buildRunId: null,
    expiresAt: new Date(Date.now() + 60_000),
    inputHash: "input-hash",
    waiver: null,
    summary: {
      evidenceIdentity: {
        sourcePolicyRevisionId: "policy-1",
        sourcePolicySnapshotHash: "policy-hash",
        sourceCommitSha: "a".repeat(40),
        commitAuthorUserId: "author-1",
      },
      decisionIdentity: {
        checkpoint: "build_pre_execution",
        approvalSubjectHash: "subject-hash",
        actionInputHash: "action-hash",
        requesterActorId: "requester-1",
      },
    },
  };

  it.each(["requester-1", "author-1"])(
    "rejects self approval by %s",
    async (actorId) => {
      const prisma = prismaDouble();
      const repository = new GateEvaluationRepository(prisma as never);
      await expect(repository.confirmManual(input(actorId))).rejects.toThrow();
      expect(prisma.gateManualApproval.create).not.toHaveBeenCalled();
    },
  );

  it("accepts a distinct second actor and appends an exact approval", async () => {
    const prisma = prismaDouble();
    const repository = new GateEvaluationRepository(prisma as never);
    await expect(repository.confirmManual(input("reviewer-1"))).resolves.toEqual({
      ...row,
      manualApprovals: [{ id: "approval-1" }],
    });
    expect(prisma.gateManualApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          evaluationInputHash: row.inputHash,
          approvalSubjectHash: "subject-hash",
          actionInputHash: "action-hash",
          requesterActorId: "requester-1",
          reviewerActorId: "reviewer-1",
        }),
      }),
    );
  });

  function prismaDouble() {
    return {
      gateEvaluation: {
        findFirst: jest.fn().mockResolvedValue(row),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...row,
          manualApprovals: [{ id: "approval-1" }],
        }),
      },
      gateManualApproval: {
        create: jest.fn().mockResolvedValue({ id: "approval-1" }),
      },
      project: {
        findUnique: jest.fn().mockResolvedValue({
          currentSourcePolicyRevisionId: "policy-1",
        }),
      },
      sourcePolicyRevision: {
        findFirst: jest.fn().mockResolvedValue({ id: "policy-1" }),
      },
      buildRun: { findUnique: jest.fn() },
    };
  }

  function input(actorId: string) {
    return {
      teamId: "team-1",
      projectId: "project-1",
      releaseOrderId: "order-1",
      evaluationId: row.id,
      gateId: "C03",
      actorId,
      reason: "Reviewed exact candidate",
    };
  }
});
