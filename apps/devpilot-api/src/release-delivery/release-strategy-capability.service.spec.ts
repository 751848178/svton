import { UnprocessableEntityException } from "@nestjs/common";
import { ReleaseStrategyCapabilityService } from "./release-strategy-capability.service";

describe("ReleaseStrategyCapabilityService", () => {
  const service = new ReleaseStrategyCapabilityService();

  it("allows only the standard strategy", () => {
    expect(service.get("standard")).toMatchObject({ executable: true });
    for (const strategy of ["canary", "blue_green", "automatic_traffic"] as const) {
      expect(service.get(strategy)).toMatchObject({
        executable: false,
        reasonCode: "release_strategy_capabilities_unavailable",
      });
      expect(service.get(strategy).missingCapabilities).toEqual(
        expect.arrayContaining([
          "real_traffic_provider",
          "metric_analysis_provider",
          "pause_and_abort_provider",
          "automatic_rollback_provider",
        ]),
      );
    }
  });

  it("fails closed with concrete missing provider reasons", () => {
    expect(() => service.requireExecutable("canary")).toThrow(
      UnprocessableEntityException,
    );
  });
});

