import { UnprocessableEntityException } from "@nestjs/common";
import { ReleaseGateManualConfirmationService } from "./release-gate-manual-confirmation.service";

describe("ReleaseGateManualConfirmationService", () => {
  const evaluations = { confirmManual: jest.fn() };
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
});
