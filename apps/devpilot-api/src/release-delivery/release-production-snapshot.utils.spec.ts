import { UnprocessableEntityException } from "@nestjs/common";
import { productionPreview } from "./release-production-snapshot.utils";

const BUNDLE_DIGEST = `sha256:${"b".repeat(64)}`;
const COMPONENT_DIGEST = `sha256:${"c".repeat(64)}`;

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
        applicationServices: [{
          id: "service-1",
          releaseComponentKey: "component-1",
          applicationId: "application-1",
          name: "api",
          kind: "service",
          ports: [],
          deployConfig: {
            deployCommand: "node dist/server.js",
            healthCheckUrl: "http://127.0.0.1:3000/health",
          },
        }],
      },
    ],
    manifest: {
      id: "manifest-1",
      digest: BUNDLE_DIGEST,
      buildRun: {
        id: "build-1",
        revision: 3,
        status: "succeeded",
        sourceBranch: "main",
        sourceCommitSha: "abc123",
      },
      items: [
        { componentKey: "project-bundle", digest: BUNDLE_DIGEST },
        { componentKey: "component-1", digest: COMPONENT_DIGEST, artifactType: "zip" },
      ],
    },
    stagingProof: {
      id: "deployment-1",
      environmentId: "staging-1",
      finishedAt: new Date("2026-08-03T00:00:00.000Z"),
      params: {
        manifestId: "manifest-1",
        manifestDigest: BUNDLE_DIGEST,
        workload: { services: [{
          componentKey: "component-1", artifactDigest: COMPONENT_DIGEST,
        }] },
      },
      result: {
        artifactVerified: true,
        manifestId: "manifest-1",
        manifestDigest: BUNDLE_DIGEST,
      },
    },
    strategy: "standard",
    releasePolicy: {
      id: "policy-1",
      revision: 4,
      strategy: "standard",
      requireProductionApproval: true,
      snapshotHash: "policy-hash",
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
      manifest: { id: "manifest-1", digest: BUNDLE_DIGEST },
      stagingProof: { deploymentRunId: "deployment-1" },
      config: { revisionId: "config-1", snapshotHash: "config-hash" },
      releasePolicy: { revisionId: "policy-1", revision: 4, strategy: "standard" },
    });
  });

  it("changes the approval hash when the immutable release policy changes", () => {
    const original = context();
    const changed = context();
    changed.releasePolicy.snapshotHash = "new-policy-hash";
    expect(productionPreview(changed).inputHash).not.toBe(
      productionPreview(original).inputHash,
    );
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

  it("fails closed when a valid component digest drifts after Staging", () => {
    const invalid = context();
    invalid.manifest.items[1].digest = `sha256:${"d".repeat(64)}`;
    expect(() => productionPreview(invalid)).toThrow(
      "Staging 验证制品不一致",
    );
  });
});
