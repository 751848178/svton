import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";

export function localAcceptancePromotionEvidence(input: {
  providerKey: string;
  observedAt: Date;
  manifest: {
    id: string;
    digest: string;
    deploymentRuns: Array<{ id: string; result: unknown }>;
  };
  deploymentInputHash: string;
  workloadInputHash: string;
  evidence: Record<string, unknown>;
}) {
  if (input.providerKey !== "local-filesystem-v1") return undefined;
  const workload = record(input.evidence.workloadReady);
  const health = record(input.evidence.healthProbe);
  const http = record(input.evidence.httpProbe);
  const observability = record(input.evidence.observability);
  const staging = input.manifest.deploymentRuns.find(({ result }) => {
    const proof = record(result);
    return proof.artifactVerified === true &&
      proof.manifestId === input.manifest.id &&
      proof.manifestDigest === input.manifest.digest;
  });
  const exact = workload.status === "passed" && health.status === "passed" &&
    http.status === "passed" && observability.profile === "local_acceptance_v1" &&
    observability.acceptanceOnly === true &&
    observability.deploymentInputHash === input.deploymentInputHash &&
    observability.workloadInputHash === input.workloadInputHash;
  if (!staging || !exact) return undefined;
  const processChecks = positiveInteger(health.processChecks);
  const httpChecks = positiveInteger(http.checkedServices);
  if (processChecks === 0 || httpChecks === 0) return undefined;
  const base = {
    version: 1,
    profile: "local_acceptance_v1",
    acceptanceOnly: true,
    applicabilityPolicy: "local-single-host-acceptance-v1",
    providerKey: input.providerKey,
    observedAt: input.observedAt.toISOString(),
    manifestId: input.manifest.id,
    manifestDigest: input.manifest.digest,
    stagingDeploymentRunId: staging.id,
    deploymentInputHash: input.deploymentInputHash,
    workloadInputHash: input.workloadInputHash,
    signals: { workload: "passed", health: "passed", http: "passed" },
  };
  const evidenceHash = hashCanonicalReleaseValue(base);
  return {
    promotionMetrics: {
      ...base,
      evidenceHash,
      status: "technical_only",
      conclusion: "candidate_runtime_signals_stable",
    },
    promotionObservation: {
      ...base,
      evidenceHash,
      windowSeconds: 1,
      minimumWindowSeconds: 1,
      sampleCount: processChecks + httpChecks,
      minimumSampleCount: 1,
    },
  };
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
