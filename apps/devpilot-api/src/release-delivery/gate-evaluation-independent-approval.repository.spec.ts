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
        sourceCommitSha: "a".repeat(40),
        commitAuthorUserId: "author-1",
      },
    },
  };

  it.each(["requester-1", "author-1"])(
    "rejects self approval by %s",
    async (actorId) => {
      const prisma = prismaDouble();
      const repository = new GateEvaluationRepository(prisma as never);
      await expect(repository.confirmManual(input(actorId))).rejects.toThrow();
      expect(prisma.gateEvaluation.updateMany).not.toHaveBeenCalled();
    },
  );

  it("accepts a distinct second actor and binds the waiver to inputHash", async () => {
    const prisma = prismaDouble();
    const repository = new GateEvaluationRepository(prisma as never);
    await expect(repository.confirmManual(input("reviewer-1"))).resolves.toEqual({
      ...row,
      waiver: { stored: true },
    });
    expect(prisma.gateEvaluation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: row.id, inputHash: row.inputHash }),
      }),
    );
  });

  function prismaDouble() {
    return {
      gateEvaluation: {
        findFirst: jest.fn().mockResolvedValue(row),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...row,
          waiver: { stored: true },
        }),
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
