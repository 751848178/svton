import { ReleaseGateBlockedException } from "./release-gate-decision.service";
import { finalizeDeployedEnvironment } from "./environment-version-production-finalization";
import {
  finalizationContext,
  finalizationDependencies,
  gateDecision,
} from "./environment-version-production-finalization.spec-utils";

describe("Production post-deploy finalization", () => {
  const originalProfile = process.env.DEVPILOT_RELEASE_FLOW_PROFILE;

  afterEach(() => {
    if (originalProfile === undefined) delete process.env.DEVPILOT_RELEASE_FLOW_PROFILE;
    else process.env.DEVPILOT_RELEASE_FLOW_PROFILE = originalProfile;
  });

  it("completes the basic deployment without a promotion phase", async () => {
    const deps = finalizationDependencies();
    const result = await finalizeDeployedEnvironment(
      deps as never,
      finalizationContext() as never,
      ["deployed"],
      { deployment: "ok" },
    );

    expect(deps.promotionAwaiting.wait).not.toHaveBeenCalled();
    expect(deps.completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        result: expect.objectContaining({ promotionStatus: "not_required" }),
      }),
    );
    expect(result).toMatchObject({ status: "completed" });
  });

  it("retains awaiting validation for the governed profile", async () => {
    process.env.DEVPILOT_RELEASE_FLOW_PROFILE = "governed_v1";
    const deps = finalizationDependencies();
    await finalizeDeployedEnvironment(
      deps as never,
      finalizationContext() as never,
      ["deployed"],
      { deployment: "ok" },
    );

    expect(deps.promotionAwaiting.wait).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "actor-1",
        candidate: expect.objectContaining({ releaseRunId: "release-1" }),
      }),
    );
    expect(deps.completion.complete).not.toHaveBeenCalled();
  });

  it("does not create awaiting state when post-deploy gates block", async () => {
    const deps = finalizationDependencies();
    const blocked = gateDecision({ allowed: false, blockerGateIds: ["P02"] });
    deps.productionGates.finalize.mockRejectedValue(
      new ReleaseGateBlockedException(blocked as never),
    );

    await finalizeDeployedEnvironment(
      deps as never,
      finalizationContext() as never,
      ["deployed"],
      { deployment: "ok" },
    );

    expect(deps.promotionAwaiting.wait).not.toHaveBeenCalled();
    expect(deps.completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });
});
