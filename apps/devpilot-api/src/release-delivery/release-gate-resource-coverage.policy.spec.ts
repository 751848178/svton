import { runtimeResourceCoverage } from "./release-gate-resource-coverage.policy";

describe("runtimeResourceCoverage", () => {
  it("maps every direct and instance reference to one exact managed resource", () => {
    expect(runtimeResourceCoverage(fixture() as never)).toEqual([
      expect.objectContaining({
        referenceId: "managed-1", managedResourceId: "managed-1", stateful: true,
      }),
      expect.objectContaining({
        referenceId: "instance-1", managedResourceId: "managed-2", stateful: true,
      }),
    ]);
  });

  it("fails closed for missing and ambiguous instance mappings", () => {
    const deploy = fixture();
    deploy.resources[1].mappedManagedResourceIds = [];
    expect(runtimeResourceCoverage(deploy as never)?.[1]).toMatchObject({
      managedResourceId: null,
      reasonCode: "resource_instance_managed_mapping_missing",
    });
    deploy.resources[1].mappedManagedResourceIds = ["managed-2", "managed-3"];
    expect(runtimeResourceCoverage(deploy as never)?.[1]).toMatchObject({
      managedResourceId: null,
      reasonCode: "resource_instance_managed_mapping_ambiguous",
    });
  });

  it("allows a project-scoped instance through one Production managed mapping", () => {
    const deploy = fixture();
    (deploy.resources[1] as { environmentId: string | null }).environmentId = null;
    expect(runtimeResourceCoverage(deploy as never)?.[1]).toMatchObject({
      referenceId: "instance-1",
      managedResourceId: "managed-2",
    });
  });

  it("rejects an instance explicitly owned by another environment", () => {
    const deploy = fixture();
    deploy.resources[1].environmentId = "staging-1";
    expect(runtimeResourceCoverage(deploy as never)?.[1]).toMatchObject({
      managedResourceId: null,
      reasonCode: "resource_environment_mismatch",
    });
  });
});

function fixture() {
  return {
    environment: {
      id: "production-1",
      currentConfigRevision: { resourceReferences: [
        { id: "managed-1", kind: "managed_resource", stateful: true },
        { id: "instance-1", kind: "resource_instance", stateful: true },
      ] },
    },
    resources: [
      { id: "managed-1", kind: "managed_resource", environmentId: "production-1" },
      { id: "instance-1", kind: "resource_instance", environmentId: "production-1",
        mappedManagedResourceIds: ["managed-2"] },
    ],
  };
}
