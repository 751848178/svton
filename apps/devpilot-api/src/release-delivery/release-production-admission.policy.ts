import { UnprocessableEntityException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { releaseGateCheckpointPolicy } from "./release-gate-checkpoint.policy";
import { productionMutableEvidenceCurrent } from "./release-production-mutable-admission.policy";
import type { ReleaseDeploymentInputSnapshot } from "./release-deployment-input.types";

export type ProductionAdmissionProof = {
  preApprovalAllowed: boolean;
  previewInputHash: string;
  deploymentInputHash: string;
  workloadInputHash: string;
  deploymentSnapshot: ReleaseDeploymentInputSnapshot;
  capacitySnapshotId?: string;
  dnsProbeReceiptId?: string;
  checks: Array<{
    id: string; status: string; fresh: boolean | null;
    expiresAt: string | null;
    evidenceIdentity?: Record<string, string | number | null>;
  }>;
};

export async function assertProductionAdmissionProof(
  tx: Prisma.TransactionClient,
  proof: ProductionAdmissionProof,
  expected: { teamId: string; projectId: string; environmentId: string;
    previewInputHash: string; deploymentInputHash: string; workloadInputHash: string },
) {
  const required = releaseGateCheckpointPolicy("production_pre_execution")
    .requiredGateIds.filter((id) => id !== "D13");
  const checks = new Map(proof.checks.map((check) => [check.id, check]));
  const now = Date.now();
  const valid = proof.preApprovalAllowed &&
    proof.previewInputHash === expected.previewInputHash &&
    proof.deploymentInputHash === expected.deploymentInputHash &&
    proof.workloadInputHash === expected.workloadInputHash &&
    required.every((id) => {
      const check = checks.get(id);
      return check?.status === "checked" && check.fresh === true &&
        (!check.expiresAt || new Date(check.expiresAt).getTime() >= now);
    });
  if (!valid) blocked();
  if (proof.deploymentSnapshot.inputHash !== expected.deploymentInputHash) blocked();
  if (proof.capacitySnapshotId) {
    const capacity = await tx.serverCapacitySnapshot.findFirst({ where: {
      id: proof.capacitySnapshotId,
      deploymentInputHash: expected.deploymentInputHash,
      workloadInputHash: expected.workloadInputHash,
      expiresAt: { gte: new Date(now) },
    }, select: { status: true } });
    if (!capacity || capacity.status !== "fit") blocked();
  }
  if (proof.dnsProbeReceiptId) {
    const dns = await tx.siteDnsProbeReceipt.findFirst({ where: {
      id: proof.dnsProbeReceiptId,
      deploymentInputHash: expected.deploymentInputHash,
      workloadInputHash: expected.workloadInputHash,
      status: "resolved", expiresAt: { gte: new Date(now) },
    }, select: { id: true } });
    if (!dns) blocked();
  }
  if (!await productionMutableEvidenceCurrent(tx, proof, expected)) blocked();
}

function blocked(): never {
  throw new UnprocessableEntityException({
    code: "PRODUCTION_PREFLIGHT_STALE",
    message: "Production 前置检查已过期或漂移，请刷新后重试",
  });
}
