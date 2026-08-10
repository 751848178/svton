import { buildReleaseDeliveryMigrationReport } from "./release-delivery-migration-report.utils";

describe("release delivery migration report", () => {
  it("keeps legacy plans and artifact-looking deployment data unverified", () => {
    const report = buildReleaseDeliveryMigrationReport({
      releasePlans: [{ id: "plan-1", projectId: "project-1" }],
      deploymentRuns: [
        {
          id: "deployment-1",
          projectId: "project-1",
          status: "completed",
          legacyArtifactDigest: "sha256:observed-only",
        },
      ],
      environments: [
        {
          id: "environment-1",
          projectId: "project-1",
          completedDeploymentRuns: 1,
        },
      ],
    });

    expect(report.summary).toEqual({
      linkedReleasePlans: 0,
      linkedDeploymentRuns: 0,
      linkedEnvironmentVersions: 0,
      unverified: 3,
      syntheticManifests: 0,
    });
    expect(report.issues).toContainEqual({
      entityType: "deployment_run",
      entityId: "deployment-1",
      projectId: "project-1",
      reason: "manifest_link_missing",
      observedLegacyDigest: "sha256:observed-only",
    });
  });

  it("counts only explicit new-domain links as verified", () => {
    const report = buildReleaseDeliveryMigrationReport({
      releasePlans: [
        {
          id: "plan-linked",
          projectId: "project-1",
          releaseOrderId: "order-1",
        },
      ],
      deploymentRuns: [
        {
          id: "deployment-linked",
          projectId: "project-1",
          status: "completed",
          artifactManifestId: "manifest-1",
          environmentVersionId: "version-1",
        },
      ],
      environments: [
        {
          id: "environment-linked",
          projectId: "project-1",
          completedDeploymentRuns: 1,
          currentEnvironmentVersionId: "version-1",
        },
      ],
    });

    expect(report.summary).toEqual({
      linkedReleasePlans: 1,
      linkedDeploymentRuns: 1,
      linkedEnvironmentVersions: 1,
      unverified: 0,
      syntheticManifests: 0,
    });
    expect(report.issues).toEqual([]);
  });
});
