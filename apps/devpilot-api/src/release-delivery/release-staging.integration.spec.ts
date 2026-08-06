import "reflect-metadata";
import { ReleaseStagingProviderIntegrationFixture } from "./release-staging-provider.integration-fixture";
import { seedReleaseStagingNegativeManifests } from "./release-staging-negative.integration-fixture";

const describeIntegration =
  process.env.RUN_RELEASE_STAGING_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("ReleaseStaging integration", () => {
  const fixture = new ReleaseStagingProviderIntegrationFixture();

  beforeAll(() => fixture.start());
  afterAll(() => fixture.stop());

  it("delivers the same exact Manifest through two fresh DeploymentRuns", async () => {
    const beforeBuilds = await fixture.buildCount();
    const first = await fixture.deploy();
    const second = await fixture.deploy();
    expect(first.id).not.toBe(second.id);
    expect(first.artifactManifestId).toBe(fixture.manifestId);
    expect(second.artifactManifestId).toBe(fixture.manifestId);
    await expect(fixture.deploymentCount()).resolves.toBe(2);
    await expect(fixture.buildCount()).resolves.toBe(beforeBuilds);
    const rows = await fixture.deploymentRows();
    expect(rows.every((row) => row.status === "completed")).toBe(true);
    expect(rows.every((row) => row.adapterKey === "local-filesystem-v1")).toBe(
      true,
    );
    expect(JSON.stringify(rows)).toContain('"build":false');
    for (const run of [first.id, second.id]) {
      await expect(fixture.readTargetFile(run)).resolves.toBe(
        "real provider target",
      );
    }
  });

  it("rejects unknown, foreign, failed, and related-BuildRun scope drift", async () => {
    const invalid = await seedReleaseStagingNegativeManifests(fixture.prisma, {
      suffix: fixture.userId,
      userId: fixture.userId,
      teamId: fixture.teamId,
      projectId: fixture.projectId,
      orderId: fixture.orderId,
    });
    try {
      const before = await fixture.allDeploymentCount();
      for (const manifestId of [
        "unknown-manifest",
        invalid.crossOrder,
        invalid.crossProject,
        invalid.crossTeam,
      ]) {
        await expect(fixture.deployManifest(manifestId)).rejects.toThrow(
          "Manifest 不存在或不属于当前发布单",
        );
      }
      await expect(fixture.deployManifest(invalid.scopeDrift)).rejects.toThrow(
        "关联 BuildRun 不属于当前发布单",
      );
      await expect(fixture.deployManifest(invalid.failed)).rejects.toThrow(
        "只有成功 BuildRun",
      );
      await expect(fixture.allDeploymentCount()).resolves.toBe(before);
    } finally {
      await invalid.cleanup();
    }
  });
});
