import { approvedWorkloadIdentity,
  frozenApprovedWorkload } from "./release-approved-workload.policy";
import { assertEnvironmentVersionApprovedWorkload } from "./environment-version-approved-workload";

describe("Environment Version approved provider boundary", () => {
  it("rejects executor provider drift before deployment reservation", () => {
    const frozenInput = { workload: workload() } as never;
    expect(() => assertEnvironmentVersionApprovedWorkload({ policySnapshot: {
      approvedWorkload: frozenApprovedWorkload(approvedWorkloadIdentity(workload())),
      deploymentProviderKey: "local-filesystem-v1",
    } }, frozenInput, "ssh-v1")).toThrow(
      "Deployment Provider 已在审批后漂移",
    );
  });

  it("accepts the exact frozen provider and workload", () => {
    expect(() => assertEnvironmentVersionApprovedWorkload({ policySnapshot: {
      approvedWorkload: frozenApprovedWorkload(approvedWorkloadIdentity(workload())),
      deploymentProviderKey: "local-filesystem-v1",
    } }, { workload: workload() } as never, "local-filesystem-v1"))
      .not.toThrow();
  });
});

function workload() {
  return { version: 1 as const, environmentId: "production-1",
    manifestId: "manifest-1", manifestDigest: `sha256:${"a".repeat(64)}`,
    services: [], inputHash: "workload-1" };
}
