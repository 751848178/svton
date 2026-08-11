import { evaluateCandidatePromotionGate } from "./release-gate-candidate-promotion.policy";

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
    },
  };
}
