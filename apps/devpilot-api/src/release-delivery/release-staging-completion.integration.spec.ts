import "reflect-metadata";
import { deployWithStagingCompletionAckLoss } from "./release-staging-completion-ambiguity.integration-fixture";
import { ReleaseStagingProviderIntegrationFixture } from "./release-staging-provider.integration-fixture";

const describeIntegration =
  process.env.RUN_RELEASE_STAGING_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("ReleaseStaging terminal completion", () => {
  const fixture = new ReleaseStagingProviderIntegrationFixture();

  beforeAll(() => fixture.start());
  afterAll(() => fixture.stop());

  it("keeps committed success after an ambiguous transaction acknowledgement", async () => {
    const beforeVersions = await fixture.prisma.environmentVersion.count({
      where: { environmentId: fixture.stagingId },
    });
    const run = await deployWithStagingCompletionAckLoss(
      fixture.repository,
      fixture.deploy,
    );
    expect(run.status).toBe("completed");
    await expect(
      fixture.prisma.deploymentRun.findUniqueOrThrow({
        where: { id: run.id },
        select: { status: true, error: true },
      }),
    ).resolves.toEqual({ status: "completed", error: null });
    await expect(
      fixture.prisma.environmentVersion.count({
        where: { environmentId: fixture.stagingId },
      }),
    ).resolves.toBe(beforeVersions + 1);
    await expect(
      fixture.prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: fixture.stagingId },
        select: {
          currentEnvironmentVersion: { select: { deploymentRunId: true } },
        },
      }),
    ).resolves.toEqual({
      currentEnvironmentVersion: { deploymentRunId: run.id },
    });
  });
});
