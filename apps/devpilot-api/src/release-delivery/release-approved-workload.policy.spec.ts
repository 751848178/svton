import { UnprocessableEntityException } from "@nestjs/common";
import {
  approvedWorkloadIdentity,
  assertApprovedWorkload,
  frozenApprovedWorkload,
} from "./release-approved-workload.policy";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";

describe("approved Production workload identity", () => {
  const workload = {
    version: 1 as const,
    environmentId: "production-1",
    manifestId: "manifest-1",
    manifestDigest: "sha256:manifest",
    inputHash: "workload-1",
    services: [{
      serviceId: "service-1", componentKey: "component-1", stateHash: "state-1",
    }],
  } as unknown as ReleaseStagingWorkloadSnapshot;

  it("accepts the exact workload frozen into the approval subject", () => {
    const frozen = frozenApprovedWorkload(approvedWorkloadIdentity(workload));
    expect(() => assertApprovedWorkload({ approvedWorkload: frozen }, workload))
      .not.toThrow();
  });

  it("rejects command, resource or health drift after approval", () => {
    const frozen = frozenApprovedWorkload(approvedWorkloadIdentity(workload));
    const drifted = {
      ...workload,
      inputHash: "workload-2",
      services: [{
        serviceId: "service-1", componentKey: "component-1", stateHash: "state-2",
      }],
    } as ReleaseStagingWorkloadSnapshot;
    expect(() => assertApprovedWorkload({ approvedWorkload: frozen }, drifted))
      .toThrow(UnprocessableEntityException);
  });
});
