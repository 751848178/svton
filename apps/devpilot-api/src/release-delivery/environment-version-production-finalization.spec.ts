import { ReleaseGateBlockedException } from "./release-gate-decision.service";
import { finalizeDeployedEnvironment } from "./environment-version-production-finalization";
import {
  finalizationContext,
  finalizationDependencies,
  gateDecision,
} from "./environment-version-production-finalization.spec-utils";

describe("Production post-deploy finalization", () => {
  it("moves the exact deployed candidate to awaiting_validation", async () => {
    const deps = finalizationDependencies();
    const result = await finalizeDeployedEnvironment(
      deps as never,
      finalizationContext() as never,
      ["deployed"],
      { deployment: "ok" },
    );

    expect(deps.promotionAwaiting.wait).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "actor-1",
        candidate: expect.objectContaining({
          releaseRunId: "release-1",
          deploymentRunId: "deployment-1",
          manifestId: "manifest-1",
          candidateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(deps.completion.complete).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      run: { status: "awaiting_validation" },
      version: null,
    });
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
