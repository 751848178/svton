import type { ReleaseBuildHttpRuntimeFixture } from "./release-build-http-runtime.fixture";
import { seedReleaseStagingNegativeManifests } from "./release-staging-negative.integration-fixture";

export async function verifyRejectedStagingHttpManifests(
  fixture: ReleaseBuildHttpRuntimeFixture,
) {
  const invalid = await seedReleaseStagingNegativeManifests(
    fixture.git.prisma,
    {
      suffix: fixture.git.suffix,
      userId: fixture.git.userId,
      teamId: fixture.git.teamId,
      projectId: fixture.git.projectId,
      orderId: fixture.git.orderId,
    },
  );
  try {
    const before = await fixture.git.prisma.deploymentRun.count({
      where: { teamId: fixture.git.teamId },
    });
    const cases = [
      ["unknown-manifest", 404],
      [invalid.crossOrder, 404],
      [invalid.crossProject, 404],
      [invalid.crossTeam, 404],
      [invalid.scopeDrift, 404],
      [invalid.failed, 422],
    ] as const;
    for (const [manifestId, expected] of cases) {
      const response = await fixture.request(fixture.stagingPath(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manifestId }),
      });
      expect(response.status).toBe(expected);
    }
    await expect(
      fixture.git.prisma.deploymentRun.count({
        where: { teamId: fixture.git.teamId },
      }),
    ).resolves.toBe(before);
  } finally {
    await invalid.cleanup();
  }
}
