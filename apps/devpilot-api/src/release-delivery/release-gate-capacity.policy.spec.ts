import { evaluateExactCapacity } from "./release-gate-capacity.policy";

describe("evaluateExactCapacity", () => {
  const now = new Date("2026-08-12T01:02:00.000Z");

  it("accepts only the exact fresh capacity receipt", () => {
    const context = fixture();
    expect(evaluateExactCapacity(context as never, now)).toMatchObject({
      status: "checked",
      reasonCode: "capacity_fit_local_single_tenant",
      evidenceIdentity: {
        capacitySnapshotId: "capacity-1",
        workloadInputHash: "workload-hash",
      },
    });
    context.decisionTarget.capacitySnapshotHash = "different";
    expect(evaluateExactCapacity(context as never, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "capacity_snapshot_scope_mismatch",
    });
  });

  it("keeps an SSH capacity baseline unavailable without reservation proof", () => {
    const context = fixture();
    context.deploy.capacities[0].status = "insufficient";
    context.deploy.capacities[0].reasonCode = "capacity_reservation_provider_missing";
    expect(evaluateExactCapacity(context as never, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "capacity_reservation_provider_missing",
    });
  });
});

function fixture() {
  const sampledAt = new Date("2026-08-12T01:00:00.000Z");
  return {
    decisionTarget: {
      capacitySnapshotId: "capacity-1",
      capacitySnapshotHash: "measurement-hash",
      configRevisionId: "revision-1",
      buildRunId: "build-1",
      manifestId: "manifest-1",
      providerKey: "local-filesystem-v1",
      bindingId: "binding-1",
      deploymentInputHash: "deployment-hash",
      workloadInputHash: "workload-hash",
    },
    deploy: { capacities: [{
      id: "capacity-1",
      configRevisionId: "revision-1",
      buildRunId: "build-1",
      manifestId: "manifest-1",
      providerKey: "local-filesystem-v1",
      bindingId: "binding-1",
      deploymentInputHash: "deployment-hash",
      workloadInputHash: "workload-hash",
      requirementHash: "requirement-hash",
      measurementHash: "measurement-hash",
      status: "fit",
      reasonCode: "capacity_fit_local_single_tenant",
      sampledAt,
      expiresAt: new Date(sampledAt.getTime() + 300_000),
    }] },
  };
}
