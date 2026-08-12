import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluated, unavailable } from "./release-gate-provider.types";

export function evaluateExactCapacity(
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const target = context.decisionTarget;
  const snapshot = context.deploy?.capacities.find(
    (item) => item.id === target?.capacitySnapshotId,
  );
  if (!snapshot || !target?.capacitySnapshotHash) {
    return unavailable(
      "capacity_snapshot_missing",
      "缺少绑定当前工作负载的真实服务器容量快照",
      "A real server-capacity snapshot bound to the current workload is missing",
    );
  }
  const exact = snapshot.configRevisionId === target.configRevisionId &&
    snapshot.buildRunId === target.buildRunId &&
    snapshot.manifestId === target.manifestId &&
    snapshot.providerKey === target.providerKey &&
    snapshot.bindingId === target.bindingId &&
    snapshot.deploymentInputHash === target.deploymentInputHash &&
    snapshot.workloadInputHash === target.workloadInputHash &&
    snapshot.measurementHash === target.capacitySnapshotHash;
  if (!exact) {
    return unavailable(
      "capacity_snapshot_scope_mismatch",
      "服务器容量快照与当前冻结动作不一致",
      "The server-capacity snapshot does not match the frozen action",
    );
  }
  if (snapshot.reasonCode === "capacity_reservation_provider_missing") {
    return unavailable(
      snapshot.reasonCode,
      "已采集目标容量基线，但缺少配额或预留 Provider，无法证明可用容量",
      "Target capacity was sampled, but no quota or reservation provider proves available capacity",
    );
  }
  return evaluated({
    status: snapshot.status === "fit" ? "checked" : "blocked",
    reasonCode: snapshot.status === "fit"
      ? snapshot.reasonCode === "capacity_fit_local_single_tenant"
        ? snapshot.reasonCode : "capacity_fit"
      : "capacity_insufficient",
    zh: snapshot.status === "fit"
      ? "真实服务器容量快照可容纳冻结工作负载"
      : "真实服务器容量不足以容纳冻结工作负载",
    en: snapshot.status === "fit"
      ? "The real server-capacity snapshot can fit the frozen workload"
      : "The real server capacity cannot fit the frozen workload",
    evidenceRef: `server-capacity-snapshot:${snapshot.id}`,
    checkedAt: snapshot.sampledAt,
    ttlMs: Math.max(1, snapshot.expiresAt.getTime() - snapshot.sampledAt.getTime()),
    now,
    evidenceIdentity: {
      capacitySnapshotId: snapshot.id,
      capacitySnapshotHash: snapshot.measurementHash,
      requirementHash: snapshot.requirementHash,
      deploymentInputHash: snapshot.deploymentInputHash,
      workloadInputHash: snapshot.workloadInputHash,
    },
  });
}
