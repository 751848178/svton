import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { ReleaseGateManualConfirmationService } from "./release-gate-manual-confirmation.service";

describe("ReleaseGateManualConfirmationService", () => {
  const evaluations = {
    confirmManual: jest.fn(),
    manualConfirmationTarget: jest.fn(),
  };
  const service = new ReleaseGateManualConfirmationService(
    evaluations as never,
  );
  const input = {
    teamId: "team-1",
    actorId: "user-1",
    projectId: "project-1",
    releaseOrderId: "order-1",
    evaluationId: "evaluation-1",
    reason: "Reviewed exact evidence",
  };

  beforeEach(() => jest.clearAllMocks());

  it("delegates only a gate whose canonical definition permits manual disposition", async () => {
    evaluations.confirmManual.mockResolvedValue({ id: "evaluation-1" });
    await service.confirm({ ...input, gateId: "C06" });
    expect(evaluations.confirmManual).toHaveBeenCalledWith({
      ...input,
      gateId: "C06",
    });
  });

  it("rejects manual confirmation for a technical-only blocker", () => {
    expect(() => service.confirm({ ...input, gateId: "C01" })).toThrow(
      UnprocessableEntityException,
    );
    expect(evaluations.confirmManual).not.toHaveBeenCalled();
  });

  it("resolves commit/build permission from the persisted gate", async () => {
    evaluations.manualConfirmationTarget.mockResolvedValue({
      id: "evaluation-1", gateId: "C06", buildRunId: "build-1",
      releaseRunId: null, summary: {},
    });
    await expect(service.resolve({ ...input, gateId: "C06" }))
      .resolves.toEqual({ permission: "build" });
  });

  it("allows exact build_pre confirmation before a BuildRun exists", async () => {
    evaluations.manualConfirmationTarget.mockResolvedValue({
      id: "evaluation-1", gateId: "C03", buildRunId: null,
      releaseRunId: null, summary: { decisionIdentity: {
        checkpoint: "build_pre_execution",
        approvalSubjectHash: "subject-hash",
        actionInputHash: "action-hash",
        requesterActorId: "requester-1",
      } },
    });
    await expect(service.resolve({ ...input, gateId: "C03" }))
      .resolves.toEqual({ permission: "build" });
  });

  it("requires exact candidate identity for a persisted promote gate", async () => {
    evaluations.manualConfirmationTarget.mockResolvedValue({
      id: "evaluation-1", gateId: "P03", buildRunId: "build-1",
      releaseRunId: "release-1", summary: { decisionIdentity: {
        deploymentRunId: "deployment-1", candidateHash: "a".repeat(64),
      }, evidenceIdentity: { releaseRunId: "release-1",
        deploymentRunId: "deployment-1", candidateHash: "a".repeat(64) } },
    });
    await expect(service.resolve({ ...input, gateId: "P03" }))
      .resolves.toEqual({ permission: "production" });
  });

  it("rejects a spoofed gate id even when the evaluation id exists", async () => {
    evaluations.manualConfirmationTarget.mockResolvedValue({
      id: "evaluation-1", gateId: "P03", summary: {},
    });
    await expect(service.resolve({ ...input, gateId: "C06" }))
      .rejects.toThrow(NotFoundException);
  });
});
