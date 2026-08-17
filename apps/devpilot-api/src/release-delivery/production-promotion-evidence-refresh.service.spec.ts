import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { evaluateCandidatePromotionGate } from "./release-gate-candidate-promotion.policy";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { ReleaseGateObservabilityCapabilityProvider } from "./release-gate-observability-capability.provider";
import { ProductionPromotionEvidenceRefreshService } from "./production-promotion-evidence-refresh.service";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";

const OLD = "2026-08-12T07:54:00.000Z";
const NOW = new Date("2026-08-12T08:00:00.000Z");

describe("ProductionPromotionEvidenceRefreshService", () => {
  it("refreshes a stale exact local candidate before P04/P05/P06", async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const fixture = createFixture();
    const before = gateStatuses(fixture.result);
    await fixture.service.refresh(candidate());
    const saved = fixture.update.mock.calls[0][0].data.result;

    expect(before).toEqual(["unchecked", "unchecked", "unchecked"]);
    expect(gateStatuses(saved)).toEqual(["checked", "checked", "checked"]);
    expect(saved.promotionObservation.observedAt).toBe(NOW.toISOString());
    expect(fixture.executor.refreshPromotionEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ deploymentRunId: "deployment-1" }),
    );
    jest.useRealTimers();
  });

  it("fails closed when the runtime probe cannot prove readiness", async () => {
    const fixture = createFixture();
    fixture.executor.refreshPromotionEvidence.mockResolvedValue(undefined);
    await fixture.service.refresh(candidate());
    expect(fixture.update).not.toHaveBeenCalled();
  });

  it("does not overwrite a candidate that drifted before the CAS lock", async () => {
    const fixture = createFixture();
    fixture.locked.result.productionCandidate.candidateHash = "d".repeat(64);
    await fixture.service.refresh(candidate());
    expect(fixture.update).not.toHaveBeenCalled();
  });

  it("rejects a tampered command retaining the old declared hashes before probing", async () => {
    const fixture = createFixture();
    const row = await fixture.findFirst();
    fixture.findFirst.mockResolvedValue({
      ...row,
      params: { workload: { ...workload(), services: [{
        ...workload().services[0], startCommand: "node tampered.js",
      }] } },
    });
    await fixture.service.refresh(candidate());
    expect(fixture.executor.refreshPromotionEvidence).not.toHaveBeenCalled();
    expect(fixture.update).not.toHaveBeenCalled();
  });

  it("does not collect local evidence for an external provider", async () => {
    const fixture = createFixture("ssh-v1");
    await fixture.service.refresh(candidate());
    expect(fixture.findFirst).not.toHaveBeenCalled();
  });
});

function createFixture(providerKey = "local-filesystem-v1") {
  const result = resultEvidence();
  const locked = { result: structuredClone(result) };
  const findFirst = jest.fn().mockResolvedValue({
    params: { workload: workload() }, result,
    artifactManifest: {
      id: "manifest-1", digest: "sha256:manifest",
      deploymentRuns: [{ id: "staging-1", result: {
        artifactVerified: true, manifestId: "manifest-1",
        manifestDigest: "sha256:manifest",
      } }],
    },
  });
  const update = jest.fn().mockResolvedValue({});
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    deploymentRun: { findFirst: jest.fn().mockResolvedValue(locked), update },
  };
  const prisma = {
    deploymentRun: { findFirst },
    $transaction: jest.fn((action) => action(tx)),
  };
  const executor = {
    providerKey,
    refreshPromotionEvidence: jest.fn().mockResolvedValue(runtimeEvidence()),
  };
  return {
    result, locked, findFirst, update, executor,
    service: new ProductionPromotionEvidenceRefreshService(prisma as never, executor as never),
  };
}

function candidate() {
  return {
    teamId: "team-1", projectId: "project-1", environmentId: "production-1",
    releaseRunId: "release-1", deploymentRunId: "deployment-1",
    candidateHash: "c".repeat(64), deploymentInputHash: "deployment-input",
    workloadInputHash: workload().inputHash, manifestId: "manifest-1",
    manifestDigest: "sha256:manifest", workloadServiceCount: 1,
  } as never;
}

function resultEvidence() {
  return {
    ...runtimeEvidence(),
    productionCandidate: { candidateHash: "c".repeat(64) },
    observability: {
      profile: "local_acceptance_v1", acceptanceOnly: true,
      deploymentInputHash: "deployment-input", workloadInputHash: workload().inputHash,
    },
    promotionMetrics: { ...promotionBase(), status: "technical_only" },
    promotionObservation: {
      ...promotionBase(), windowSeconds: 1, minimumWindowSeconds: 1,
      sampleCount: 2, minimumSampleCount: 1,
    },
  };
}

function promotionBase() {
  return {
    profile: "local_acceptance_v1", acceptanceOnly: true,
    applicabilityPolicy: "local-single-host-acceptance-v1", observedAt: OLD,
  };
}

function runtimeEvidence() {
  return {
    workloadReady: { status: "passed" },
    healthProbe: { status: "passed", processChecks: 1 },
    httpProbe: { status: "passed", checkedServices: 1 },
  };
}

function workload() {
  const serviceState = {
    serviceId: "service-1", applicationId: "application-1", componentKey: "api",
    name: "api", kind: "service", artifactDigest: "sha256:component",
    workingDirectory: ".", executionMode: "managed-process-v1",
    startCommand: "node server.js", startTimeoutMs: 5_000, statusTimeoutMs: 1_000,
  };
  const state = {
    version: 1, environmentId: "production-1", manifestId: "manifest-1",
    manifestDigest: "sha256:manifest",
    services: [{ ...serviceState, stateHash: hashCanonicalReleaseValue(serviceState) }],
  };
  return { ...state, inputHash: hashCanonicalReleaseValue(state) };
}

function gateStatuses(result: Record<string, unknown>) {
  const context = {
    decisionCheckpoint: "production_promote_pre_route",
    decisionTarget: { deploymentRunId: "deployment-1", candidateHash: "c".repeat(64) },
    promote: { releaseRun: { deploymentRuns: [{
      id: "deployment-1", result, createdAt: new Date(OLD),
    }] }, logRuns: [], metrics: [], alerts: [] },
  } as unknown as ReleaseGateEvidenceContext;
  const provider = new ReleaseGateObservabilityCapabilityProvider();
  return [
    provider.evaluate(RELEASE_GATE_DEFINITIONS.find((gate) => gate.id === "P04")!, context, NOW),
    evaluateCandidatePromotionGate("P05", context, NOW),
    evaluateCandidatePromotionGate("P06", context, NOW),
  ].map((item) => item?.status);
}
