import { evaluateFrozenObservabilityConfig } from "./release-gate-observability-config.policy";

describe("evaluateFrozenObservabilityConfig", () => {
  const now = new Date("2026-08-12T00:00:00.000Z");

  it("allows the registered local profile only for the local executor", () => {
    const context = fixture("local-filesystem-v1");
    expect(evaluateFrozenObservabilityConfig(context as never, now)).toMatchObject({
      status: "checked",
      reasonCode: "observability_config_frozen_local_acceptance",
    });
    context.decisionTarget.providerKey = "ssh-v1";
    expect(evaluateFrozenObservabilityConfig(context as never, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "observability_provider_missing",
    });
  });
});

function fixture(providerKey: string) {
  return {
    decisionTarget: {
      configRevisionId: "config-1", deploymentInputHash: "deployment-hash",
      workloadInputHash: "workload-hash", providerKey,
    },
    deploy: { environment: { currentConfigRevision: {
      id: "config-1", snapshotHash: "snapshot-hash", createdAt: new Date(),
      observabilitySnapshot: {
        version: 1, profile: "local_acceptance_v1",
        logs: "local-runtime-logs-v1", metrics: "local-health-probe-v1",
        traces: "not-applicable-single-host-v1",
        alerts: "not-applicable-local-acceptance-v1",
      },
    } } },
  };
}
