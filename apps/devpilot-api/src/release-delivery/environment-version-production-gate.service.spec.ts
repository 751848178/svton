import { EnvironmentVersionProductionGateService } from "./environment-version-production-gate.service";
import { ReleaseGateBlockedException } from "./release-gate-decision.service";

describe("EnvironmentVersionProductionGateService", () => {
  const gates = { assertAllowed: jest.fn() };
  const routeSagaGuard = { assertClear: jest.fn() };
  const service = new EnvironmentVersionProductionGateService(
    gates as never,
    routeSagaGuard as never,
  );
  const context = {
    teamId: "team-1",
    actorId: "user-1",
    projectId: "project-1",
    releaseOrderId: "order-1",
    environmentId: "environment-1",
    configRevisionId: "config-1",
    manifestId: "manifest-1",
    buildRunId: "build-1",
    releaseRunId: "release-1",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    routeSagaGuard.assertClear.mockResolvedValue(undefined);
  });

  it("enforces Staging with the same fail-closed gate semantics", async () => {
    gates.assertAllowed.mockResolvedValue(decision("staging", true));
    await service.admit({ ...context, releaseRunId: undefined }, "staging");
    expect(gates.assertAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        checkpoint: "staging_pre_execution",
        requestKey: "pre:staging:manifest-1",
        target: expect.objectContaining({
          environmentId: "environment-1",
          manifestId: "manifest-1",
        }),
      }),
    );
    expect(gates.assertAllowed.mock.calls[0][0]).not.toHaveProperty(
      "deferredReasons",
    );
  });

  it("does not defer unavailable Production gates before or after execution", async () => {
    gates.assertAllowed.mockResolvedValue(decision("production", true));
    await service.admit(context);
    await service.finalize({ ...context, deploymentRunId: "deployment-1" });
    expect(gates.assertAllowed).toHaveBeenCalledTimes(2);
    for (const [request] of gates.assertAllowed.mock.calls) {
      expect(request).not.toHaveProperty("deferredReasons");
    }
  });

  it("blocks Production admission while a route saga is unresolved", async () => {
    routeSagaGuard.assertClear.mockRejectedValueOnce(
      new Error("compensation_required"),
    );

    await expect(service.admit(context)).rejects.toThrow(
      "compensation_required",
    );
    expect(gates.assertAllowed).not.toHaveBeenCalled();
  });

  it("preserves the persisted blocked decision when final enforcement fails", async () => {
    const denied = decision("production", false);
    const error = new ReleaseGateBlockedException(denied);
    await expect(
      service.denied(error, { ...context, deploymentRunId: "deployment-1" }),
    ).resolves.toBe(denied);
    expect(gates.assertAllowed).not.toHaveBeenCalled();
  });
});

function decision(stage: "staging" | "production", allowed: boolean) {
  return {
    id: `decision-${stage}-${allowed}`,
    stage,
    checkpoint:
      stage === "staging"
        ? ("staging_pre_execution" as const)
        : ("production_pre_execution" as const),
    phase: stage === "staging" ? ("build" as const) : ("deploy" as const),
    approvalSubjectHash: "subject-hash",
    actionInputHash: "action-hash",
    requesterActorId: "user-1",
    allowed,
    blockerGateIds: allowed ? [] : [stage === "staging" ? "B06" : "D17"],
    manualGateIds: [],
    confirmedManualGateIds: [],
    warningGateIds: [],
    deferredGateIds: [],
    evidenceOnlyGateIds: [],
    integrityErrors: [],
    inputHash: "input-hash",
    decidedAt: new Date(0).toISOString(),
  };
}
