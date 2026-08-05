import "reflect-metadata";
import { presentBuild } from "./release-build.presenter";
import { ReleaseBuildRuntimeFixture } from "./release-build-runtime.integration-fixture";

const describeIntegration =
  process.env.RUN_RELEASE_BUILD_INTEGRATION === "1" ? describe : describe.skip;

describeIntegration("ReleaseBuild integration", () => {
  const fixture = new ReleaseBuildRuntimeFixture();

  beforeAll(() => fixture.start());
  afterAll(() => fixture.stop());

  it("allocates a monotonic revision for every independent build", async () => {
    const first = await reserve();
    const second = await reserve();
    expect([first.revision, second.revision]).toEqual([1, 2]);
    expect(first.sourceCommitSha).toBe("a".repeat(40));
    expect(second.sourceCommitSha).toBe("a".repeat(40));
  });

  it("keeps historical presentation frozen after joined identity mutation", async () => {
    const reserved = await reserve();
    await fixture.prisma.projectRepositoryIdentity.update({
      where: { id: fixture.identityId },
      data: {
        provider: "mutated-provider",
        canonicalUrl: "https://mutated.example/repository",
      },
    });
    try {
      const listed = (
        await fixture.repository.list(
          fixture.teamId,
          fixture.projectId,
          fixture.orderId,
        )
      ).find((run) => run.id === reserved.id);
      if (!listed) throw new Error("Reserved BuildRun missing from list");
      expect(listed.repositoryIdentity).toMatchObject({
        provider: "mutated-provider",
        canonicalUrl: "https://mutated.example/repository",
      });
      expect(presentBuild(listed)).toMatchObject({
        sourceRepository: {
          provider: "generic",
          canonicalUrl: "https://example.com/repo",
          identityRevisionId: fixture.identityRevisionId,
          identityRevision: 1,
          branch: "main",
        },
      });
    } finally {
      await fixture.prisma.projectRepositoryIdentity.update({
        where: { id: fixture.identityId },
        data: {
          provider: "generic",
          canonicalUrl: "https://example.com/repo",
        },
      });
    }
  });

  it("creates one immutable Manifest only for a successful run", async () => {
    const failed = await reserve();
    await fixture.results.fail({
      buildRunId: failed.id,
      code: "BUILD_COMMAND_FAILED",
      message: "failed",
      logReference: `build-log://${failed.id}`,
      logSummary: { redacted: true, lines: [] },
      gateSummary: { build: { status: "failed" } },
    });
    await expect(
      fixture.prisma.artifactManifest.count({
        where: { buildRunId: failed.id },
      }),
    ).resolves.toBe(0);

    const succeeded = await reserve();
    await fixture.results.succeed({
      buildRunId: succeeded.id,
      teamId: fixture.teamId,
      projectId: fixture.projectId,
      releaseOrderId: fixture.orderId,
      digest: `sha256:${"b".repeat(64)}`,
      uri: `release-artifact://${succeeded.id}/bundle.zip`,
      sizeBytes: 42,
      sourceBranch: succeeded.sourceBranch,
      sourceCommitSha: succeeded.sourceCommitSha,
      inputHash: succeeded.inputHash,
      repositoryIdentityId: fixture.identityId,
      repositoryIdentityRevisionId: fixture.identityRevisionId,
      repositoryProvider: "generic",
      canonicalRepositoryUrl: "https://example.com/repo",
      logReference: `build-log://${succeeded.id}`,
      logSummary: { redacted: true, lines: ["ok"] },
      gateSummary: { build: { status: "passed" } },
    });
    await expect(
      fixture.prisma.artifactManifest.count({
        where: { buildRunId: succeeded.id },
      }),
    ).resolves.toBe(1);
  });

  function reserve() {
    return fixture
      .reservation()
      .then((input) => fixture.repository.reserve(input));
  }
});
