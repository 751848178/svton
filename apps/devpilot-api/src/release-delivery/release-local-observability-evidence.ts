import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";

export function localAcceptanceObservabilityEvidence(input: {
  providerKey: string;
  configSnapshotHash: string;
  deploymentInputHash: string;
  workloadInputHash: string;
  snapshot: Record<string, unknown>;
  evidence: Record<string, unknown>;
  logs: string[];
}) {
  if (
    input.providerKey !== "local-filesystem-v1" ||
    input.snapshot.version !== 1 ||
    input.snapshot.profile !== "local_acceptance_v1"
  ) return undefined;
  const workload = record(input.evidence.workloadReady);
  const health = record(input.evidence.healthProbe);
  const logsObserved = input.logs.length > 0;
  const healthObserved = workload.status === "passed" && health.status === "passed";
  const base = {
    version: 1,
    profile: "local_acceptance_v1",
    acceptanceOnly: true,
    logs: logsObserved ? "observed" : "missing",
    metrics: healthObserved ? "observed" : "missing",
    traces: "not_applicable",
    alerts: "not_applicable",
    applicabilityPolicy: "local-single-host-acceptance-v1",
    configSnapshotHash: input.configSnapshotHash,
    deploymentInputHash: input.deploymentInputHash,
    workloadInputHash: input.workloadInputHash,
    providerEvidence: {
      workloadStatus: workload.status ?? null,
      healthStatus: health.status ?? null,
      sanitizedLogCount: input.logs.length,
    },
  };
  return { ...base, evidenceHash: hashCanonicalReleaseValue(base) };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
