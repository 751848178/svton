import { finalizeDeployedEnvironment } from "./environment-version-production-finalization";
import {
  finalizationContext,
  finalizationDependencies,
} from "./environment-version-production-finalization.spec-utils";

describe("Production awaiting-state failure boundary", () => {
  it("never advances a version or route pointer when awaiting persistence fails", async () => {
    const deps = finalizationDependencies();
    deps.promotionAwaiting.wait.mockRejectedValue(
      new Error("AWAITING_VALIDATION_WRITE_CONFLICT"),
    );

    const result = await finalizeDeployedEnvironment(
      deps as never,
      finalizationContext() as never,
      ["deployed"],
      { deployment: "ok" },
    );

    expect(deps.completion.complete).toHaveBeenCalledTimes(1);
    expect(deps.completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    expect(deps.completion.complete).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
    expect(result).toMatchObject({ status: "failed" });
  });
});
