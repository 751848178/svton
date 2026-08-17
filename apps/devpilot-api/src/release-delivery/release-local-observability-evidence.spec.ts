import { localAcceptanceObservabilityEvidence } from "./release-local-observability-evidence";

describe("localAcceptanceObservabilityEvidence", () => {
  const input = {
    providerKey: "local-filesystem-v1",
    configSnapshotHash: "config-hash",
    deploymentInputHash: "deployment-hash",
    workloadInputHash: "workload-hash",
    snapshot: {
      version: 1, profile: "local_acceptance_v1",
      logs: "local", metrics: "local", traces: "local", alerts: "local",
    },
    evidence: {
      workloadReady: { status: "passed" },
      healthProbe: { status: "passed" },
    },
    logs: ["workload ready"],
  };

  it("produces hash-bound acceptance-only evidence from actual runtime facts", () => {
    expect(localAcceptanceObservabilityEvidence(input)).toMatchObject({
      acceptanceOnly: true,
      logs: "observed", metrics: "observed",
      traces: "not_applicable", alerts: "not_applicable",
      applicabilityPolicy: "local-single-host-acceptance-v1",
      deploymentInputHash: "deployment-hash",
      workloadInputHash: "workload-hash",
      evidenceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("never upgrades an external provider or incomplete runtime to local evidence", () => {
    expect(localAcceptanceObservabilityEvidence({
      ...input, providerKey: "ssh-v1",
    })).toBeUndefined();
    expect(localAcceptanceObservabilityEvidence({
      ...input, evidence: { workloadReady: { status: "failed" } },
    })).toMatchObject({
      logs: "observed", metrics: "missing",
      traces: "not_applicable", alerts: "not_applicable",
    });
  });
});
