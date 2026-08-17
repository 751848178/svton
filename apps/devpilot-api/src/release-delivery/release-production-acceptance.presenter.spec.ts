import { presentReleaseAcceptanceMode } from "./release-production-acceptance.presenter";

describe("Release Production acceptance presenter", () => {
  it("retains technical acceptance from exact deployment evidence after success", () => {
    expect(presentReleaseAcceptanceMode({ deploymentRuns: [{ result: {
      promotionMetrics: { profile: "local_acceptance_v1", acceptanceOnly: true,
        applicabilityPolicy: "local-single-host-acceptance-v1" },
    } }] })).toBe("technical_acceptance");
  });

  it("retains technical acceptance from the frozen local provider before deployment", () => {
    expect(presentReleaseAcceptanceMode({
      policySnapshot: { acceptanceMode: "technical_acceptance",
        deploymentProviderKey: "local-filesystem-v1" },
      deploymentRuns: [],
    })).toBe("technical_acceptance");
  });

  it("does not infer local acceptance from an untrusted boolean alone", () => {
    expect(presentReleaseAcceptanceMode({
      deploymentRuns: [{ result: { acceptanceOnly: true } }],
    })).toBe("production");
  });
});
