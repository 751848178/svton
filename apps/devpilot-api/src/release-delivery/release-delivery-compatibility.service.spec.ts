import { ReleaseDeliveryCompatibilityService } from "./release-delivery-compatibility.service";

describe("ReleaseDeliveryCompatibilityService", () => {
  it("keeps legacy data readable but never upgrades inferred digests to verified manifests", async () => {
    const repository = {
      snapshot: jest.fn().mockResolvedValue({
        project: { id: "project-1", onboardingStatus: "ready", archivedAt: null },
        releasePlans: [{ id: "plan-1", projectId: "project-1" }],
        deploymentRuns: [{
          id: "legacy-run",
          projectId: "project-1",
          status: "completed",
          legacyArtifactDigest: "sha256:observed-only",
        }],
        environments: [{
          id: "production-1",
          projectId: "project-1",
          completedDeploymentRuns: 1,
        }],
        history: [{
          id: "legacy-run",
          status: "completed",
          artifactManifestId: null,
          logsRetained: true,
          startedAt: new Date("2026-08-03T00:00:00.000Z"),
        }],
        logStreams: 1,
        logEntries: 3,
      }),
    };
    const result = await new ReleaseDeliveryCompatibilityService(
      repository as never,
    ).get("team-1", "project-1");
    expect(result.executionBoundary).toEqual({
      newDeliveryInput: "persisted_artifact_manifest",
      checkoutDuringDeployment: false,
      buildDuringDeployment: false,
      legacyBranchDeploymentForGovernedProject: false,
    });
    expect(result.report.summary).toMatchObject({
      unverified: 3,
      syntheticManifests: 0,
    });
    expect(result.history.deploymentRuns[0]).toMatchObject({
      classification: "legacy_unverified",
      readOnly: true,
      logsRetained: true,
    });
  });
});
