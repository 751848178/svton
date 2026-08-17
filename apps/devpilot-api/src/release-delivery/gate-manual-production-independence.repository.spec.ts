import { GateEvaluationRepository } from "./gate-evaluation.repository";

describe("P03 independent candidate approval", () => {
  it.each([
    ["actor-action", "action requester", "动作请求人不能确认自己的人工门禁"],
    ["actor-release", "release requester", "必须由非动作请求人、非发布请求人的独立人员确认"],
    ["actor-approval", "approval requester", "必须由非动作请求人、非发布请求人的独立人员确认"],
  ])("rejects %s as %s without appending approval", async (actorId, _role, message) => {
    const prisma = prismaDouble();
    const repository = new GateEvaluationRepository(prisma as never);
    await expect(repository.confirmManual(input(actorId))).rejects.toThrow(
      message,
    );
    expect(prisma.gateManualApproval.create).not.toHaveBeenCalled();
  });

  it("accepts a distinct third actor for the exact waiting candidate", async () => {
    const prisma = prismaDouble();
    const repository = new GateEvaluationRepository(prisma as never);
    await expect(repository.confirmManual(input("actor-independent")))
      .resolves.toMatchObject({ id: "evaluation-p03" });
    expect(prisma.gateManualApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        reviewerActorId: "actor-independent",
      }) }),
    );
  });

  it.each([
    ["wrong scope", { projectId: "other-project" }, "作用域不一致"],
    ["completed release", { status: "succeeded" }, "不再等待人工验证"],
  ])("rejects %s", async (_name, releasePatch, message) => {
    const prisma = prismaDouble(releasePatch);
    const repository = new GateEvaluationRepository(prisma as never);
    await expect(repository.confirmManual(input("actor-independent")))
      .rejects.toThrow(message);
    expect(prisma.gateManualApproval.create).not.toHaveBeenCalled();
  });
});

const evaluation = {
  id: "evaluation-p03", teamId: "team-1", projectId: "project-1",
  releaseOrderId: "order-1", releaseRunId: "release-1", buildRunId: null,
  gateId: "P03", status: "needs_human", providerKey: "promotion_manual",
  inputHash: "evaluation-input", expiresAt: null,
  summary: {
    evidenceIdentity: { releaseRunId: "release-1", deploymentRunId: "deploy-1",
      candidateHash: "candidate-1" },
    decisionIdentity: { deploymentRunId: "deploy-1", candidateHash: "candidate-1",
      approvalSubjectHash: "subject-1", actionInputHash: "action-1",
      requesterActorId: "actor-action" },
  },
};

function prismaDouble(releasePatch: Record<string, unknown> = {}) {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: evaluation.id }]),
    $transaction: jest.fn(),
    gateEvaluation: {
      findFirst: jest.fn().mockResolvedValue(evaluation),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...evaluation, manualApprovals: [] }),
    },
    releaseRun: { findFirst: jest.fn().mockResolvedValue({
      actorId: "actor-release", environmentId: "production-1",
      status: "awaiting_validation", ...releasePatch,
      operationApproval: { requesterId: "actor-approval", teamId: "team-1",
        projectId: releasePatch.projectId ?? "project-1", environmentId: "production-1" },
      deploymentRuns: [{ id: "deploy-1", status: "awaiting_validation",
        result: { productionCandidate: { candidateHash: "candidate-1" } } }],
    }) },
    gateManualApproval: { create: jest.fn().mockResolvedValue({ id: "manual-1" }) },
  };
  prisma.$transaction.mockImplementation(async (action) => action(prisma));
  return prisma;
}

function input(actorId: string) {
  return { teamId: "team-1", projectId: "project-1", releaseOrderId: "order-1",
    evaluationId: evaluation.id, gateId: "P03", actorId,
    reason: "Independently verified exact candidate" };
}
