import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluateReleaseGateSource } from "./release-gate-source-connection-evaluator";

const NOW = new Date("2026-08-09T00:00:00.000Z");

describe("evaluateReleaseGateSource", () => {
  it("preserves a stored failed-connection reason before source fallback", () => {
    const context = sourceContext("failed");
    context.decisionTarget = { sourceResolution: "unavailable" };

    expect(evaluateReleaseGateSource("C01", context, NOW)).toMatchObject({
      status: "blocked",
      reasonCode: "repository_verification_failed",
      evidenceRef: "repository-connection:connection-1",
    });
  });

  it("keeps source resolution unavailable for a connected repository", () => {
    const context = sourceContext("connected");
    context.decisionTarget = { sourceResolution: "unavailable" };

    expect(evaluateReleaseGateSource("C01", context, NOW)).toMatchObject({
      status: "unavailable",
      reasonCode: "repository_source_resolution_failed",
    });
  });
});

function sourceContext(status: "connected" | "failed") {
  return {
    project: {
      repositoryConnection: {
        id: "connection-1",
        status,
        errorCode: "repository_verification_failed",
        verifiedAt: status === "connected" ? NOW : null,
        updatedAt: NOW,
      },
    },
    buildRuns: [],
  } as unknown as ReleaseGateEvidenceContext;
}
