import { UnprocessableEntityException } from "@nestjs/common";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";

export type ApprovedWorkloadIdentity = {
  inputHash: string;
  services: Array<{
    serviceId: string;
    componentKey: string;
    stateHash: string;
  }>;
};

export function approvedWorkloadIdentity(
  workload: ReleaseStagingWorkloadSnapshot,
): ApprovedWorkloadIdentity {
  return {
    inputHash: workload.inputHash,
    services: workload.services.map((service) => ({
      serviceId: service.serviceId,
      componentKey: service.componentKey,
      stateHash: service.stateHash,
    })),
  };
}

export function assertApprovedWorkload(
  policySnapshot: unknown,
  workload: ReleaseStagingWorkloadSnapshot,
) {
  const policy = record(policySnapshot);
  const frozen = record(policy.approvedWorkload);
  const current = approvedWorkloadIdentity(workload);
  if (
    frozen.inputHash !== current.inputHash ||
    frozen.identityHash !== hashCanonicalReleaseValue(current)
  ) {
    throw new UnprocessableEntityException(
      "Production 服务工作负载已在审批后漂移，请重新申请审批",
    );
  }
}

export function frozenApprovedWorkload(identity: ApprovedWorkloadIdentity) {
  return { ...identity, identityHash: hashCanonicalReleaseValue(identity) };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
