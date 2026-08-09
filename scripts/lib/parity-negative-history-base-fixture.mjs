export const BASE_MANIFEST_DIGEST = `sha256:${"a".repeat(64)}`;

export function baseContextFixture() {
  return {
    teamId: "team",
    projectId: "project",
    orderId: "order",
    stagingEnvId: "staging",
    productionEnvId: "production",
    buildRunId: "build-1",
    manifestId: "manifest-1",
    manifestDigest: BASE_MANIFEST_DIGEST,
    stagingDeploymentRunId: "deploy-1",
    stagingCurrentVersionId: "staging-v1",
    productionCurrentVersionId: "production-v1",
    productionConfigRevisionId: "config-1",
    productionRouteSnapshot: {
      domains: ["production.example.test"],
      proxyTarget: "http://target-workload",
      tlsRequired: true,
    },
    productionTargetRef: "target",
    repositoryConnectionId: "connection",
    analysisRunId: "analysis",
    reviewSnapshotId: "review",
    reviewSnapshotHash: "b".repeat(64),
    intakeFinalizationId: "finalization",
    repositoryIdentityId: "identity",
    applicationContracts: [
      {
        applicationId: "web",
        staging: { id: "web-staging" },
        production: { id: "web-production" },
      },
      {
        applicationId: "api",
        staging: { id: "api-staging" },
        production: { id: "api-production" },
      },
    ],
    pinnedCommit: "a".repeat(40),
    finalSitePort: 54321,
    sourceEvidenceSha256: "d".repeat(64),
  };
}

export function baseRowsFixture(context) {
  return {
    buildRuns: [
      {
        id: context.buildRunId,
        status: "succeeded",
        sourceCommitSha: context.pinnedCommit,
      },
    ],
    manifests: [
      {
        id: context.manifestId,
        digest: context.manifestDigest,
        buildRunId: context.buildRunId,
      },
    ],
    stagingVersions: [
      {
        id: context.stagingCurrentVersionId,
        kind: "deploy",
        artifactManifestId: context.manifestId,
        deploymentRunId: context.stagingDeploymentRunId,
      },
    ],
    productionVersions: [
      {
        id: context.productionCurrentVersionId,
        kind: "upgrade",
        artifactManifestId: context.manifestId,
        releaseRunId: "release-1",
      },
    ],
    environments: [
      {
        id: context.stagingEnvId,
        key: "staging",
        currentEnvironmentVersionId: context.stagingCurrentVersionId,
      },
      {
        id: context.productionEnvId,
        key: "production",
        currentEnvironmentVersionId: context.productionCurrentVersionId,
      },
    ],
    expected: structuredClone(context),
  };
}
