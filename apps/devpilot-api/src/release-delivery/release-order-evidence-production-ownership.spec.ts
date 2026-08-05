import { exactProductionProof } from "./release-order-evidence-production-ownership";

const scope = {
  teamId: "team-1",
  projectId: "project-1",
  releaseOrderId: "order-1",
};

describe("exactProductionProof", () => {
  it("accepts the exact scoped non-dry-run Staging proof", () => {
    const proof = validProof();

    expect(
      exactProductionProof(
        validRun() as never,
        new Map([[proof.id, proof]]) as never,
        scope,
      ),
    ).toBe(proof);
  });

  it.each([
    ["dry-run", { dryRun: true }],
    [
      "environment id drift",
      { projectEnvironment: environment({ id: "env-2" }) },
    ],
    [
      "environment team drift",
      { projectEnvironment: environment({ teamId: "team-2" }) },
    ],
    [
      "environment project drift",
      { projectEnvironment: environment({ projectId: "project-2" }) },
    ],
  ])("rejects %s proof ownership", (_label, override) => {
    const proof = { ...validProof(), ...override };

    expect(
      exactProductionProof(
        validRun() as never,
        new Map([[proof.id, proof]]) as never,
        scope,
      ),
    ).toBeNull();
  });
});

function validRun() {
  return {
    id: "release-1",
    teamId: scope.teamId,
    projectId: scope.projectId,
    releaseOrderId: scope.releaseOrderId,
    environmentId: "production-env",
    artifactManifestId: "manifest-1",
    verifiedDigest: "sha256:exact",
    inputHash: "input-1",
    createdAt: new Date("2026-08-05T01:00:00Z"),
    environment: environment({
      id: "production-env",
      baselineRole: "production",
    }),
    artifactManifest: {
      id: "manifest-1",
      teamId: scope.teamId,
      projectId: scope.projectId,
      releaseOrderId: scope.releaseOrderId,
      digest: "sha256:exact",
      buildRun: {
        id: "build-1",
        teamId: scope.teamId,
        projectId: scope.projectId,
        releaseOrderId: scope.releaseOrderId,
        status: "succeeded",
      },
    },
    operationApproval: {
      id: "approval-1",
      teamId: scope.teamId,
      projectId: scope.projectId,
      environmentId: "production-env",
      category: "release",
      action: "project.release_order.deploy_production",
      targetType: "release_run",
      targetId: "release-1",
      inputHash: "input-1",
      metadata: {
        snapshot: {
          version: 2,
          projectId: scope.projectId,
          releaseOrder: { id: scope.releaseOrderId },
          build: { id: "build-1" },
          manifest: { id: "manifest-1", digest: "sha256:exact" },
          environment: { id: "production-env" },
          stagingProof: {
            deploymentRunId: "proof-1",
            environmentId: "staging-env",
            finishedAt: "2026-08-05T00:30:00.000Z",
          },
        },
      },
    },
  };
}

function validProof() {
  return {
    id: "proof-1",
    teamId: scope.teamId,
    projectId: scope.projectId,
    environmentId: "staging-env",
    artifactManifestId: "manifest-1",
    source: "release_order",
    status: "completed",
    dryRun: false,
    result: {
      artifactVerified: true,
      manifestId: "manifest-1",
      manifestDigest: "sha256:exact",
    },
    finishedAt: new Date("2026-08-05T00:30:00.000Z"),
    projectEnvironment: environment(),
  };
}

function environment(
  override: Partial<{
    id: string;
    teamId: string;
    projectId: string;
    baselineRole: string;
  }> = {},
) {
  return {
    id: "staging-env",
    teamId: scope.teamId,
    projectId: scope.projectId,
    name: "Staging",
    baselineRole: "staging",
    status: "active",
    ...override,
  };
}
