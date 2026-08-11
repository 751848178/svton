import { ProductionPromotionRecoveryService } from "./production-promotion-recovery.service";

describe("ProductionPromotionRecoveryService", () => {
  it("readbacks route state before converging or resuming expired commands", async () => {
    const repository = {
      due: jest.fn().mockResolvedValue([
        command("committed-1", "operation-1"),
        command("switched-1", "operation-2"),
        command("unknown-1", "operation-3"),
      ]),
      convergeCommitted: jest.fn().mockResolvedValue(true),
    };
    const readback = {
      inspect: jest.fn()
        .mockResolvedValueOnce("committed")
        .mockResolvedValueOnce("switched")
        .mockResolvedValueOnce("unknown"),
    };
    const promotion = { resume: jest.fn().mockResolvedValue({ status: "completed" }) };
    const service = new ProductionPromotionRecoveryService(
      repository as never,
      readback as never,
      promotion as never,
    );
    await expect(service.runOnce(new Date("2026-08-11T00:00:00.000Z")))
      .resolves.toBe(2);
    expect(readback.inspect).toHaveBeenCalledTimes(3);
    expect(repository.convergeCommitted).toHaveBeenCalledWith(
      "committed-1",
      new Date("2026-08-11T00:00:00.000Z"),
    );
    expect(promotion.resume).toHaveBeenCalledTimes(1);
    expect(promotion.resume).toHaveBeenCalledWith(expect.objectContaining({
      deploymentRunId: "deployment-switched-1",
      idempotencyKey: "idempotency-switched-1",
    }));
  });
});

function command(id: string, routeSwitchOperationId: string) {
  return {
    id, teamId: "team-1", projectId: "project-1", actorId: "actor-1",
    releaseRunId: `release-${id}`, deploymentRunId: `deployment-${id}`,
    candidateHash: `candidate-${id}`, idempotencyKey: `idempotency-${id}`,
    routeSwitchOperationId, phase: "route_switched",
    deploymentRun: { environmentId: "environment-1" },
  };
}
