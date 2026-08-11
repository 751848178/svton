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
      const listed = await fixture.repository.get(
        fixture.teamId,
        fixture.projectId,
        fixture.orderId,
        reserved.id,
      );
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
    const completed: Parameters<typeof fixture.results.succeed>[0] = {
      buildRunId: succeeded.id,
      teamId: fixture.teamId,
      projectId: fixture.projectId,
      releaseOrderId: fixture.orderId,
      digest: `sha256:${"b".repeat(64)}`,
      uri: `release-artifact://${succeeded.id}/bundle.zip`,
      sizeBytes: 42,
      contentIndex: [
        {
          path: "dist/app.js",
          digest: `sha256:${"c".repeat(64)}`,
          sizeBytes: 7,
        },
      ],
      items: [
        {
          componentKey: "service-1",
          artifactType: "zip",
          uri: `release-artifact://${succeeded.id}/components/service.zip`,
          digest: `sha256:${"d".repeat(64)}`,
          sizeBytes: 21,
          outputs: ["dist"],
          contentIndex: [
            {
              path: "dist/app.js",
              digest: `sha256:${"c".repeat(64)}`,
              sizeBytes: 7,
            },
          ],
          environment: { mode: "independent" },
        },
      ],
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
      actorId: fixture.userId,
      gateDecision: await fixture.postBuildDecision(),
    };
    await fixture.results.succeed(completed);
    await expect(
      fixture.prisma.artifactManifest.count({
        where: { buildRunId: succeeded.id },
      }),
    ).resolves.toBe(1);
    await expect(
      fixture.prisma.artifactManifestItem.count({
        where: { manifest: { buildRunId: succeeded.id } },
      }),
    ).resolves.toBe(2);
    const manifest = await fixture.prisma.artifactManifest.findUniqueOrThrow({
      where: { buildRunId: succeeded.id },
      include: { items: true },
    });
    expect(manifest.provenance).toMatchObject({
      immutable: true,
      sourceCommitSha: succeeded.sourceCommitSha,
      inputHash: succeeded.inputHash,
      artifactContractVersion: 1,
      collection: "declared-outputs-only",
      reproducibility: { status: "baseline" },
    });
    expect(manifest.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          componentKey: "service-1",
          digest: `sha256:${"d".repeat(64)}`,
          metadata: expect.objectContaining({
            outputs: ["dist"],
            environment: { mode: "independent" },
            provenance: expect.objectContaining({
              sourceCommitSha: succeeded.sourceCommitSha,
            }),
          }),
        }),
      ]),
    );

    const divergent = await reserve(succeeded.inputHash);
    expect(divergent.inputHash).toBe(succeeded.inputHash);
    await expect(
      fixture.results.succeed({
        ...completed,
        buildRunId: divergent.id,
        digest: `sha256:${"e".repeat(64)}`,
        uri: `release-artifact://${divergent.id}/bundle.zip`,
        sourceBranch: divergent.sourceBranch,
        sourceCommitSha: divergent.sourceCommitSha,
        inputHash: divergent.inputHash,
        gateDecision: await fixture.postBuildDecision(),
      }),
    ).rejects.toMatchObject({
      detail: { code: "ARTIFACT_REPRODUCIBILITY_MISMATCH" },
    });
    await fixture.results.fail({
      buildRunId: divergent.id,
      code: "ARTIFACT_REPRODUCIBILITY_MISMATCH",
      message: "digest mismatch",
      logReference: `build-log://${divergent.id}`,
      logSummary: { redacted: true, lines: [] },
      gateSummary: { artifact: { status: "failed" } },
    });
    await expect(
      fixture.prisma.artifactManifest.count({
        where: { buildRunId: divergent.id },
      }),
    ).resolves.toBe(0);
  });

  function reserve(inputHash?: string) {
    return fixture
      .reservation(inputHash)
      .then((input) => fixture.repository.reserve(input));
  }
});
