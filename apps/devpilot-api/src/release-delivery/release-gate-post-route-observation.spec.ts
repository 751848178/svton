import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { ReleaseGateProductionApplicabilityProvider } from "./release-gate-production-applicability.provider";
import { promotionProbeHash } from "./production-promotion-observation.policy";

describe("P09 exact candidate observation", () => {
  it("accepts a fresh switched route and exact candidate probe", () => {
    const provider = new ReleaseGateProductionApplicabilityProvider();
    const checkedAt = new Date();
    const checkedAtIso = checkedAt.toISOString();
    const observation = {
      version: 1 as const, primaryDomain: "app.example.com",
      finalUrl: "https://app.example.com/", probedAt: checkedAtIso,
      dns: { status: "resolved", checkedAt: checkedAtIso },
      tls: { status: "valid", checkedAt: checkedAtIso },
      http: { status: "passed", url: "https://app.example.com/",
        statusCode: 200, finalUrl: "https://app.example.com/", checkedAt: checkedAtIso },
    };
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
            promotionCandidateHash: "a".repeat(64),
            promotionObservedAt: checkedAt,
            promotionProbeHash: promotionProbeHash(observation),
            promotionObservation: observation,
            result: null,
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
