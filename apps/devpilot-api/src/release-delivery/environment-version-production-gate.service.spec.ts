import { EnvironmentVersionProductionGateService } from "./environment-version-production-gate.service";
import { ReleaseGateBlockedException } from "./release-gate-decision.service";

describe("EnvironmentVersionProductionGateService", () => {
  const gates = { assertAllowed: jest.fn() };
  const service = new EnvironmentVersionProductionGateService(gates as never);
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

  beforeEach(() => jest.clearAllMocks());

  it("defers only D17 missing-deployment evidence before execution", async () => {
    gates.assertAllowed.mockResolvedValue(decision(true));
    await service.admit(context);
    expect(gates.assertAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "production",
        target: {
          buildRunId: "build-1",
          manifestId: "manifest-1",
          releaseRunId: "release-1",
          environmentId: "environment-1",
          configRevisionId: "config-1",
        },
        requestKey: "pre:release-1",
        deferredReasons: {
          D17: ["production_deployment_missing"],
          D20: ["recovery_compatibility_provider_missing"],
        },
      }),
    );
  });

  it("requires an undeferred final decision from the exact DeploymentRun", async () => {
    gates.assertAllowed.mockResolvedValue(decision(true));
    await service.finalize({ ...context, deploymentRunId: "deployment-1" });
    expect(gates.assertAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        requestKey: "final:release-1:deployment-1",
        target: expect.objectContaining({
          deploymentRunId: "deployment-1",
          environmentId: "environment-1",
          configRevisionId: "config-1",
        }),
        actionInput: expect.objectContaining({
          checkpoint: "post_execution",
          deploymentRunId: "deployment-1",
        }),
      }),
    );
    expect(gates.assertAllowed.mock.calls[0][0]).not.toHaveProperty(
      "deferredReasons",
    );
  });

  it("preserves the persisted blocked decision when final enforcement fails", async () => {
    const denied = decision(false);
    const error = new ReleaseGateBlockedException(denied);
    await expect(
      service.denied(error, {
        ...context,
        deploymentRunId: "deployment-1",
      }),
    ).resolves.toBe(denied);
    expect(gates.assertAllowed).not.toHaveBeenCalled();
  });
});

function decision(allowed: boolean) {
  return {
    id: `decision-${allowed}`,
    stage: "production" as const,
    phase: "deploy" as const,
    allowed,
    blockerGateIds: allowed ? [] : ["D17"],
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
