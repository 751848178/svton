import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { evaluateCandidatePromotionGate } from "./release-gate-candidate-promotion.policy";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { ReleaseGateObservabilityCapabilityProvider } from "./release-gate-observability-capability.provider";
import { localAcceptanceObservabilityEvidence } from "./release-local-observability-evidence";
import { localAcceptancePromotionEvidence } from "./release-local-promotion-evidence";
import { runReleaseWorkloads } from "./release-workload-runtime";

const NOW = new Date("2026-08-12T08:00:00.000Z");

describe("local post-deploy promotion evidence", () => {
  it("turns real runtime and exact Staging proof into technical-only P04/P05/P06 evidence", async () => {
    const runtime = await runReleaseWorkloads({
      snapshot: workload(),
      releaseRoot: "/srv/releases/deploy-1",
      globalEnvironment: {},
      componentEnvironments: {},
      runtimePaths: { api: "/srv/releases/deploy-1/.devpilot/env/api.env" },
      execute: jest.fn(async (script: string) => ({
        exitCode: 0,
        stdout: script.includes("curl") ? "HTTP_STATUS=200\n" : "",
        stderr: "",
        timedOut: false,
        cancelled: false,
      })),
    });
    const observability = localAcceptanceObservabilityEvidence({
      providerKey: "local-filesystem-v1",
      configSnapshotHash: "config-hash",
      deploymentInputHash: "deployment-input",
      workloadInputHash: workload().inputHash,
      snapshot: { version: 1, profile: "local_acceptance_v1" },
      evidence: runtime.evidence,
      logs: runtime.logs,
    })!;
    const promotion = localAcceptancePromotionEvidence({
      providerKey: "local-filesystem-v1",
      observedAt: NOW,
      manifest: manifest(),
      deploymentInputHash: "deployment-input",
      workloadInputHash: workload().inputHash,
      evidence: { ...runtime.evidence, observability },
    })!;
    const context = gateContext({ ...runtime.evidence, observability, ...promotion });
    const provider = new ReleaseGateObservabilityCapabilityProvider();
    const p04 = provider.evaluate(definition("P04"), context, NOW);
    const p05 = evaluateCandidatePromotionGate("P05", context, NOW)!;
    const p06 = evaluateCandidatePromotionGate("P06", context, NOW)!;

    expect([p04, p05, p06]).toEqual([
      expect.objectContaining({ status: "checked", reasonCode: "candidate_promotion_metrics_local_acceptance_only" }),
      expect.objectContaining({ status: "checked", reasonCode: "candidate_observation_local_acceptance_only" }),
      expect.objectContaining({ status: "checked", reasonCode: "candidate_metric_conclusion_local_acceptance_only" }),
    ]);
  });

  it("does not manufacture promotion evidence for external providers or missing Staging proof", () => {
    const input = {
      observedAt: NOW,
      manifest: manifest(),
      deploymentInputHash: "deployment-input",
      workloadInputHash: workload().inputHash,
      evidence: {},
    };
    expect(localAcceptancePromotionEvidence({ ...input, providerKey: "ssh-v1" })).toBeUndefined();
    expect(localAcceptancePromotionEvidence({
      ...input,
      providerKey: "local-filesystem-v1",
      manifest: { ...manifest(), deploymentRuns: [] },
    })).toBeUndefined();
  });
});

function gateContext(result: Record<string, unknown>) {
  return {
    decisionCheckpoint: "production_promote_pre_route",
    decisionTarget: { deploymentRunId: "deploy-1", candidateHash: "candidate-1" },
    promote: { releaseRun: { deploymentRuns: [{
      id: "deploy-1",
      result: { ...result, productionCandidate: { candidateHash: "candidate-1" } },
      createdAt: NOW,
    }] }, logRuns: [], metrics: [], alerts: [] },
  } as unknown as ReleaseGateEvidenceContext;
}

function manifest() {
  return { id: "manifest-1", digest: "sha256:manifest", deploymentRuns: [{
    id: "staging-deploy-1",
    result: { artifactVerified: true, manifestId: "manifest-1", manifestDigest: "sha256:manifest" },
  }] };
}

function workload() {
  return {
    version: 1 as const,
    environmentId: "production-1",
    manifestId: "manifest-1",
    manifestDigest: "sha256:manifest",
    inputHash: "workload-input",
    services: [{
      serviceId: "api", applicationId: "app-1", componentKey: "api", name: "api",
      kind: "static", artifactDigest: "sha256:artifact", workingDirectory: ".",
      executionMode: "managed-process-v1" as const, startCommand: "node server.js",
      startTimeoutMs: 5_000, statusTimeoutMs: 1_000, stateHash: "state-1",
      health: { url: "http://127.0.0.1:4301/health", origin: "http://127.0.0.1:4301",
        maxAttempts: 1, intervalMs: 1, timeoutMs: 100 },
    }],
  };
}

function definition(id: string) {
  return RELEASE_GATE_DEFINITIONS.find((item) => item.id === id)!;
}
