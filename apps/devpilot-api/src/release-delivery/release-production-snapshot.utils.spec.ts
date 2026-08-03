import { UnprocessableEntityException } from "@nestjs/common";
import { productionPreview } from "./release-production-snapshot.utils";

function context() {
  return {
    order: { id: "order-1", projectId: "project-1", releaseVersion: "2.4.1" },
    productionEnvironments: [
      {
        id: "production-1",
        key: "production",
        name: "Production",
        currentConfigRevision: {
          id: "config-1",
          revision: 2,
          snapshotHash: "config-hash",
          resourceReferences: [{ id: "resource-1" }],
          routeSnapshot: { host: "example.test" },
          policyReferences: [{ id: "policy-1" }],
        },
      },
    ],
    manifest: {
      id: "manifest-1",
      digest: "sha256:known",
      buildRun: {
        id: "build-1",
        revision: 3,
        status: "succeeded",
        sourceBranch: "main",
        sourceCommitSha: "abc123",
      },
      items: [{ componentKey: "project-bundle", digest: "sha256:known" }],
    },
    stagingProof: {
      id: "deployment-1",
      environmentId: "staging-1",
      finishedAt: new Date("2026-08-03T00:00:00.000Z"),
      result: {
        artifactVerified: true,
        manifestId: "manifest-1",
        manifestDigest: "sha256:known",
      },
    },
  };
}

describe("productionPreview", () => {
  it("freezes the exact Production, Build, Manifest, config and Staging proof", () => {
    const first = productionPreview(context());
    const second = productionPreview(context());
    expect(second.inputHash).toBe(first.inputHash);
    expect(first.snapshot).toMatchObject({
      releaseOrder: { releaseVersion: "2.4.1" },
      environment: { id: "production-1", baselineRole: "production" },
      build: { id: "build-1", revision: 3, sourceCommitSha: "abc123" },
      manifest: { id: "manifest-1", digest: "sha256:known" },
      stagingProof: { deploymentRunId: "deployment-1" },
      config: { revisionId: "config-1", snapshotHash: "config-hash" },
    });
  });

  it("changes the approval hash when the frozen config revision changes", () => {
    const original = context();
    const changed = context();
    changed.productionEnvironments[0].currentConfigRevision.snapshotHash =
      "new-hash";
    expect(productionPreview(changed).inputHash).not.toBe(
      productionPreview(original).inputHash,
    );
  });

  it("fails closed without the exact verified Staging proof", () => {
    const missing = context();
    missing.stagingProof.result.manifestDigest = "sha256:other";
    expect(() => productionPreview(missing)).toThrow(
      UnprocessableEntityException,
    );
  });

  it("fails closed when the project artifact Digest is unknown", () => {
    const invalid = context();
    invalid.manifest.items[0].digest = "sha256:other";
    expect(() => productionPreview(invalid)).toThrow(
      UnprocessableEntityException,
    );
  });
});
