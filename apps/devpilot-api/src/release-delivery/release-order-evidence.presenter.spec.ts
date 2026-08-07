import { presentReleaseOrderEvidence } from "./release-order-evidence.presenter";

describe("presentReleaseOrderEvidence", () => {
  it("keeps the exact Build, Manifest, Staging and Production chain", () => {
    const result = presentReleaseOrderEvidence(fixture() as never);
    expect(result.buildRuns.items[0]).toMatchObject({
      id: "build-1",
      manifest: {
        id: "manifest-1",
        buildRun: { id: "build-1", revision: 1 },
        items: [{ componentKey: "project-bundle" }],
      },
    });
    expect(result.stagingDeploymentRuns.items.map((run) => run.id)).toEqual([
      "staging-2",
      "staging-1",
    ]);
    expect(result.productionReleaseRuns.items[0]).toMatchObject({
      id: "release-1",
      stagingProof: { deploymentRunId: "staging-1" },
      deploymentRuns: [{ id: "production-1", releaseRunId: "release-1" }],
      operationApproval: {
        id: "approval-1",
        status: "approved",
        risk: "high",
        reviewer: {
          id: "reviewer-1",
          name: "Reviewer",
          email: "reviewer@example.com",
        },
        reviewComment: "ok to deploy",
        consumedAt: new Date("2026-08-05T03:00:00Z"),
      },
    });
  });

  it("fails closed on a drifted Production DeploymentRun relation", () => {
    const deploymentDrift = fixture();
    deploymentDrift.productionRuns[0].deploymentRuns[0].environmentId =
      "other-env";
    const result = presentReleaseOrderEvidence(deploymentDrift as never);
    expect(result.productionReleaseRuns.items[0].deploymentRuns).toEqual([]);
  });

  it("presents siteProbe and routeSwitch blocks bound to the exact DeploymentRun", () => {
    const input = fixture();
    const deployment = input.productionRuns[0].deploymentRuns[0];
    deployment.result = {
      siteProbe: {
        version: 1,
        primaryDomain: "demo.f437.example",
        finalUrl: "https://demo.f437.example",
        probedAt: "2026-08-06T12:00:00.000Z",
        dns: {
          status: "unavailable",
          hostname: "demo.f437.example",
          error: { code: "ENOTFOUND", message: "not found" },
          checkedAt: "2026-08-06T12:00:00.000Z",
        },
        tls: {
          status: "unavailable",
          host: "demo.f437.example",
          port: 443,
          servername: "demo.f437.example",
          cert: null,
          error: { code: "ENOTFOUND", message: "not found" },
          checkedAt: "2026-08-06T12:00:00.000Z",
        },
        http: {
          status: "passed",
          url: "http://127.0.0.1:8080",
          finalUrl: "https://demo.f437.example",
          statusCode: 200,
          bodySignature: "sha256:abc",
          checkedAt: "2026-08-06T12:00:00.000Z",
        },
      },
      routeSwitch: {
        version: 1,
        siteId: "site-1",
        primaryDomain: "demo.f437.example",
        deploymentRunId: deployment.id,
        releaseRunId: "release-1",
        targetRef: "filesystem-release-target",
        proxyTarget: "http://127.0.0.1:8080",
        domains: ["demo.f437.example"],
        status: "switched",
        reasonCode: "site_switched",
        switchedAt: "2026-08-06T12:00:01.000Z",
      },
    };
    const result = presentReleaseOrderEvidence(input as never);
    const presented = result.productionReleaseRuns.items[0].deploymentRuns[0];
    expect(presented.siteProbe).toMatchObject({
      primaryDomain: "demo.f437.example",
      dns: { status: "unavailable", error: { code: "ENOTFOUND" } },
      http: { status: "passed", statusCode: 200, bodySignature: "sha256:abc" },
    });
    expect(presented.routeSwitch).toMatchObject({
      deploymentRunId: deployment.id,
      status: "switched",
      targetRef: "filesystem-release-target",
      domains: ["demo.f437.example"],
    });
  });
  it("exposes sanitized logs and the raw structured result for every DeploymentRun", () => {
    const input = fixture();
    input.productionRuns[0].deploymentRuns[0].logs = [
      "workload exact Manifest started",
      "health passed",
    ];
    input.productionRuns[0].deploymentRuns[0].result = {
      workloadReady: { status: "passed" },
      healthProbe: { status: "passed" },
    };
    const result = presentReleaseOrderEvidence(input as never);
    const presented = result.productionReleaseRuns.items[0].deploymentRuns[0];
    expect(presented.logs).toEqual([
      "workload exact Manifest started",
      "health passed",
    ]);
    expect(presented.result).toMatchObject({
      workloadReady: { status: "passed" },
      healthProbe: { status: "passed" },
    });
  });
});

function fixture() {
  const createdAt = new Date("2026-08-05T01:00:00Z");
  const manifest = {
    id: "manifest-1",
    teamId: "team-1",
    projectId: "project-1",
    releaseOrderId: "order-1",
    buildRunId: "build-1",
    digest: "sha256:exact",
    createdAt,
    items: [
      {
        componentKey: "project-bundle",
        artifactType: "zip",
        digest: "sha256:exact",
      },
    ],
    buildRun: {
      id: "build-1",
      teamId: "team-1",
      projectId: "project-1",
      releaseOrderId: "order-1",
      revision: 1,
      sourceBranch: "main",
      sourceCommitSha: "a".repeat(40),
      status: "succeeded",
    },
  };
  const environment = {
    id: "staging-env",
    teamId: "team-1",
    projectId: "project-1",
    name: "Staging",
    baselineRole: "staging",
    status: "active",
  };
  const deployment = (id: string, finishedAt: Date) => ({
    id,
    teamId: "team-1",
    projectId: "project-1",
    releaseRunId: null,
    environmentId: environment.id,
    artifactManifestId: manifest.id,
    status: "completed",
    executorKey: "release-artifact",
    adapterKey: "local-materialize",
    branch: "main",
    commitSha: "a".repeat(40),
    error: null,
    logs: [] as string[],
    startedAt: createdAt,
    finishedAt,
    createdAt,
    result: undefined as Record<string, unknown> | undefined,
    projectEnvironment: environment,
    artifactManifest: manifest,
  });
  const productionEnvironment = {
    ...environment,
    id: "production-env",
    name: "Production",
    baselineRole: "production",
  };
  const productionDeployment = {
    ...deployment("production-1", new Date("2026-08-05T03:00:00Z")),
    releaseRunId: "release-1",
    environmentId: productionEnvironment.id,
    projectEnvironment: productionEnvironment,
  };
  return {
    order: { id: "order-1", teamId: "team-1", projectId: "project-1" },
    buildRuns: [
      {
        id: "build-1",
        teamId: "team-1",
        projectId: "project-1",
        releaseOrderId: "order-1",
        revision: 1,
        sourceBranch: "main",
        sourceCommitSha: "a".repeat(40),
        status: "succeeded",
        errorCode: null,
        errorMessage: null,
        startedAt: createdAt,
        finishedAt: createdAt,
        createdAt,
        manifest,
      },
    ],
    buildTotal: 1,
    stagingRuns: [
      deployment("staging-2", new Date("2026-08-05T02:00:00Z")),
      deployment("staging-1", new Date("2026-08-05T01:30:00Z")),
    ],
    stagingTotal: 2,
    productionRuns: [
      {
        id: "release-1",
        teamId: "team-1",
        projectId: "project-1",
        releaseOrderId: "order-1",
        environmentId: productionEnvironment.id,
        artifactManifestId: manifest.id,
        status: "succeeded",
        verifiedDigest: manifest.digest,
        inputHash: "input-1",
        errorCode: null,
        errorMessage: null,
        startedAt: createdAt,
        finishedAt: new Date("2026-08-05T03:00:00Z"),
        createdAt: new Date("2026-08-05T02:30:00Z"),
        environment: productionEnvironment,
        artifactManifest: manifest,
        operationApproval: {
          id: "approval-1",
          teamId: "team-1",
          projectId: "project-1",
          environmentId: productionEnvironment.id,
          category: "release",
          action: "project.release_order.deploy_production",
          targetType: "release_run",
          targetId: "release-1",
          status: "approved",
          risk: "high",
          summary: "生产发布 1.0.0 / Build #1",
          inputHash: "input-1",
          requesterId: "requester-1",
          reviewerId: "reviewer-1",
          requester: {
            id: "requester-1",
            name: "Requester",
            email: "requester@example.com",
          },
          reviewer: {
            id: "reviewer-1",
            name: "Reviewer",
            email: "reviewer@example.com",
          },
          reviewComment: "ok to deploy",
          requestedAt: createdAt,
          reviewedAt: createdAt,
          consumedAt: new Date("2026-08-05T03:00:00Z"),
          expiresAt: null,
        },
        stagingProof: deployment("staging-1", new Date("2026-08-05T01:30:00Z")),
        deploymentRuns: [productionDeployment],
      },
    ],
    productionTotal: 1,
  };
}
