import "reflect-metadata";
import { ReleaseStagingProviderIntegrationFixture } from "./release-staging-provider.integration-fixture";

const describeIntegration =
  process.env.RUN_RELEASE_STAGING_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("F433 Staging health failure integration", () => {
  const fixture = new ReleaseStagingProviderIntegrationFixture();

  beforeAll(() => fixture.start());
  afterAll(() => fixture.stop());

  it("runs a real HTTP probe and preserves the successful current version on failure", async () => {
    const current = await fixture.deploy();
    const before = await fixture.prisma.projectEnvironment.findUniqueOrThrow({
      where: { id: fixture.stagingId },
      select: { currentEnvironmentVersionId: true },
    });
    await fixture.prisma.applicationService.update({
      where: { id: fixture.serviceId },
      data: {
        deployConfig: {
          workingDirectory: ".",
          workloadExecutionMode: "managed-command-v1",
          deployCommand: "test -f dist/app.txt",
          statusCommand: "test -f dist/app.txt",
          failureCleanupCommand: "true",
          healthCheckUrl: "http://127.0.0.1:9/health",
          healthCheckAttempts: 1,
          healthCheckIntervalMs: 0,
          healthCheckTimeoutMs: 100,
        },
      },
    });

    const failed = await fixture.deploy();
    expect(failed.status).toBe("failed");
    expect(`${failed.error}\n${JSON.stringify(failed.logs)}`).toContain(
      "WORKLOAD_HEALTH_FAILED",
    );
    await expect(
      fixture.prisma.environmentVersion.count({
        where: { environmentId: fixture.stagingId },
      }),
    ).resolves.toBe(1);
    await expect(
      fixture.prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: fixture.stagingId },
        select: { currentEnvironmentVersionId: true },
      }),
    ).resolves.toEqual(before);
    expect(JSON.parse(await fixture.readActiveFile())).toMatchObject({
      providerDeploymentId: current.id,
    });
  });
});
