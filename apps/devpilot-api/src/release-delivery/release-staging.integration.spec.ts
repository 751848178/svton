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
    await expect(
      fixture.prisma.deploymentRun.count({
        where: { artifactManifestId: fixture.manifestId },
      }),
    ).resolves.toBe(2);
    await expect(fixture.buildCount()).resolves.toBe(beforeBuilds);
    const rows = await fixture.deploymentRows();
    expect(rows.every((row) => row.status === "completed")).toBe(true);
    expect(rows.every((row) => row.adapterKey === "local-filesystem-v1")).toBe(
      true,
    );
    expect(JSON.stringify(rows)).toContain('"build":false');
    for (const run of [first.id, second.id]) {
      await expect(fixture.readReleaseFile(run, "dist/app.txt")).resolves.toBe(
        "real provider target",
      );
      const runtime = await fixture.readReleaseFile(
        run,
        ".devpilot/runtime.env",
      );
      expect(runtime).toContain("PLAIN_F432=plain-sentinel-f432");
      expect(runtime).toContain("DEPLOY_SECRET=secret-sentinel-f432");
      expect(runtime).toContain("DATABASE_HOST=mysql.staging.internal");
      expect(runtime).toContain("DATABASE_PASSWORD=resource-sentinel-f432");
    }
    const publicRows = JSON.stringify(rows);
    expect(publicRows).toContain('"snapshotHash":"f432-staging-config"');
    expect(publicRows).toContain('"stateHash"');
    expect(publicRows).toContain('"runtimeEnvironmentKeys"');
    expect(publicRows).not.toContain("secret-sentinel-f432");
    expect(publicRows).not.toContain("resource-sentinel-f432");
    await expect(
      fixture.prisma.environmentVersion.count({
        where: { environmentId: fixture.stagingId },
      }),
    ).resolves.toBe(2);
    await expect(
      fixture.prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: fixture.stagingId },
        select: {
          currentEnvironmentVersion: { select: { deploymentRunId: true } },
        },
      }),
    ).resolves.toEqual({
      currentEnvironmentVersion: { deploymentRunId: second.id },
    });
  });

  it("retains diagnostics and preserves the current version when workload startup fails", async () => {
    const before = await fixture.prisma.projectEnvironment.findUniqueOrThrow({
      where: { id: fixture.stagingId },
      select: { currentEnvironmentVersionId: true },
    });
    const versionCount = await fixture.prisma.environmentVersion.count({
      where: { environmentId: fixture.stagingId },
    });
    await fixture.prisma.applicationService.update({
      where: { id: fixture.serviceId },
      data: {
        deployConfig: {
          workingDirectory: ".",
          workloadExecutionMode: "managed-command-v1",
          deployCommand: "sh dist/fail.sh",
          statusCommand: "true",
          failureCleanupCommand: "true",
        },
      },
    });
    try {
      const failed = await fixture.deploy();
      expect(failed.status).toBe("failed");
      expect(`${failed.error}\n${JSON.stringify(failed.logs)}`).toContain(
        "WORKLOAD_START_FAILED",
      );
      expect(JSON.stringify(failed.logs)).toContain("diagnostic-sentinel-f433");
      await expect(
        fixture.prisma.environmentVersion.count({
          where: { environmentId: fixture.stagingId },
        }),
      ).resolves.toBe(versionCount);
      await expect(
        fixture.prisma.projectEnvironment.findUniqueOrThrow({
          where: { id: fixture.stagingId },
          select: { currentEnvironmentVersionId: true },
        }),
      ).resolves.toEqual(before);
      expect(JSON.parse(await fixture.readActiveFile())).not.toMatchObject({
        providerDeploymentId: failed.id,
      });
    } finally {
      await fixture.prisma.applicationService.update({
        where: { id: fixture.serviceId },
        data: {
          deployConfig: {
            workingDirectory: ".",
            workloadExecutionMode: "managed-command-v1",
            deployCommand: "test -f dist/app.txt",
            statusCommand: "test -f dist/app.txt",
            failureCleanupCommand: "true",
          },
        },
      });
    }
  });

  it.each(["config", "resource", "target"] as const)(
    "blocks %s drift before creating a DeploymentRun",
    async (kind) => {
      const before = await fixture.allDeploymentCount();
      await expect(fixture.deployWithDrift(kind)).rejects.toThrow("已漂移");
      await expect(fixture.allDeploymentCount()).resolves.toBe(before);
    },
  );

  it("blocks workload drift before creating a DeploymentRun", async () => {
    const before = await fixture.allDeploymentCount();
    await expect(fixture.deployWithWorkloadDrift()).rejects.toThrow(
      "工作负载或 Manifest 已漂移",
    );
    await expect(fixture.allDeploymentCount()).resolves.toBe(before);
  });

  it("rejects a foreign target binding before decrypting managed input", async () => {
    const before = await fixture.allDeploymentCount();
    await expect(fixture.deployWithForeignBinding()).rejects.toThrow(
      "目标绑定缺失",
    );
    await expect(fixture.allDeploymentCount()).resolves.toBe(before);
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
