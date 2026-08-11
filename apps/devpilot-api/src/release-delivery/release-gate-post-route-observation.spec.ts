import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { ReleaseGateProductionApplicabilityProvider } from "./release-gate-production-applicability.provider";

describe("P09 exact candidate observation", () => {
  it("accepts a fresh switched route and exact candidate probe", () => {
    const provider = new ReleaseGateProductionApplicabilityProvider();
    const checkedAt = new Date();
    const result = provider.evaluate(
      RELEASE_GATE_DEFINITIONS.find((item) => item.id === "P09")!,
      {
        decisionCheckpoint: "production_post_route",
        decisionTarget: {
          releaseRunId: "release-1",
          deploymentRunId: "deployment-1",
          candidateHash: "a".repeat(64),
        },
        promote: {
          routeSwitchRuns: [{
            id: "route-1", operationId: "operation-1",
            releaseRunId: "release-1", deploymentRunId: "deployment-1",
            targetRef: "server-1", status: "switched", applyReceipt: {},
            result: { candidateHash: "a".repeat(64), siteProbe: {
              dns: { status: "resolved" }, tls: { status: "valid" },
              http: { status: "passed", statusCode: 200, finalUrl: "https://app.example.com/" },
            } },
            updatedAt: checkedAt,
          }],
        },
      } as never,
      checkedAt,
    );
    expect(result).toMatchObject({
      status: "checked",
      reasonCode: "post_route_candidate_stable",
    });
  });
});
