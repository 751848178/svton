import { evaluateCandidatePromotionGate } from "./release-gate-candidate-promotion.policy";
import { promotionProbeHash } from "./production-promotion-observation.policy";

describe("exact candidate promotion gates", () => {
  const now = new Date("2026-08-11T00:03:00.000Z");

  it.each([
    ["P05", "candidate_observation_sufficient"],
    ["P06", "candidate_metric_conclusion_available"],
    ["P10", "candidate_evidence_retained"],
  ])("evaluates %s only from the exact DeploymentRun", (gateId, reasonCode) => {
    expect(evaluateCandidatePromotionGate(gateId, context() as never, now))
      .toMatchObject({ status: "checked", reasonCode });
  });

  it("fails closed when a different candidate reuses the same deployment", () => {
    const drifted = context();
    drifted.decisionTarget.candidateHash = "b".repeat(64);
    for (const gateId of ["P05", "P06", "P10"]) {
      expect(evaluateCandidatePromotionGate(gateId, drifted as never, now))
        .toMatchObject({ status: "unavailable" });
    }
  });

  it("accepts P09 only from exact typed observation columns", () => {
    const value = context();
    value.decisionCheckpoint = "production_post_route";
    value.promote.routeSwitchRuns = [routeObservation("a".repeat(64))];
    expect(evaluateCandidatePromotionGate("P09", value as never, now))
      .toMatchObject({ status: "checked", reasonCode: "post_route_candidate_stable" });
  });

  it("rejects generic result evidence and typed hash drift", () => {
    const value = context();
    value.decisionCheckpoint = "production_post_route";
    value.promote.routeSwitchRuns = [{
      ...routeObservation("a".repeat(64)),
      promotionObservation: null,
      result: { candidateHash: "a".repeat(64), siteProbe: probe() },
    }];
    expect(evaluateCandidatePromotionGate("P09", value as never, now))
      .toMatchObject({ status: "unavailable" });
    value.promote.routeSwitchRuns = [{
      ...routeObservation("a".repeat(64)), promotionProbeHash: "tampered",
    }];
    expect(evaluateCandidatePromotionGate("P09", value as never, now))
      .toMatchObject({ status: "unavailable" });
  });
});

function context() {
  const candidateHash = "a".repeat(64);
  return {
    decisionCheckpoint: "production_promote_pre_route",
    decisionTarget: {
      releaseRunId: "release-1",
      deploymentRunId: "deployment-1",
      candidateHash,
    },
    promote: {
      releaseRun: {
        deploymentRuns: [{
          id: "deployment-1",
          createdAt: new Date("2026-08-11T00:00:00.000Z"),
          result: {
            productionCandidate: { candidateHash },
            promotionObservation: {
              observedAt: "2026-08-11T00:02:00.000Z",
              windowSeconds: 120,
              minimumWindowSeconds: 60,
              sampleCount: 20,
              minimumSampleCount: 10,
            },
            promotionMetrics: {
              observedAt: "2026-08-11T00:02:00.000Z",
              status: "stable",
            },
            postDeployGateDecision: {
              id: "decision-post",
              inputHash: "c".repeat(64),
            },
          },
        }],
      },
      routeSwitchRuns: [] as Array<Record<string, unknown>>,
    },
  };
}

function routeObservation(candidateHash: string) {
  const observation = probe();
  return {
    id: "route-1", operationId: "operation-1", releaseRunId: "release-1",
    deploymentRunId: "deployment-1", status: "switched",
    promotionCandidateHash: candidateHash,
    promotionObservedAt: new Date(observation.probedAt),
    promotionProbeHash: promotionProbeHash(observation),
    promotionObservation: observation, result: null,
  };
}

function probe() {
  const checkedAt = "2026-08-11T00:02:00.000Z";
  return {
    version: 1 as const, primaryDomain: "app.example.com",
    finalUrl: "https://app.example.com", probedAt: checkedAt,
    dns: { status: "resolved", checkedAt },
    tls: { status: "valid", checkedAt },
    http: { status: "passed", url: "https://app.example.com",
      finalUrl: "https://app.example.com", statusCode: 200, checkedAt },
  };
}
