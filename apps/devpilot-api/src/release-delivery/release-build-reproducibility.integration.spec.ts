import "reflect-metadata";
import { ReleaseBuildRuntimeFixture } from "./release-build-runtime.integration-fixture";

const describeIntegration =
  process.env.RUN_RELEASE_BUILD_INTEGRATION === "1" ? describe : describe.skip;

describeIntegration("ReleaseBuild reproducibility serialization", () => {
  const fixture = new ReleaseBuildRuntimeFixture();

  beforeAll(() => fixture.start());
  afterAll(() => fixture.stop());

  it("serializes concurrent same-input completion and rejects a divergent digest", async () => {
    const inputHash = "stable-artifact-input";
    const [firstInput, secondInput] = await Promise.all([
      fixture.reservation(inputHash),
      fixture.reservation(inputHash),
    ]);
    const [first, second] = await Promise.all([
      fixture.repository.reserve(firstInput),
      fixture.repository.reserve(secondInput),
    ]);
    const outcomes = await Promise.allSettled([
      fixture.results.succeed(await completed(first, `sha256:${"a".repeat(64)}`)),
      fixture.results.succeed(await completed(second, `sha256:${"b".repeat(64)}`)),
    ]);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = outcomes.find(
      (item): item is PromiseRejectedResult => item.status === "rejected",
    );
    expect(rejected?.reason).toMatchObject({
      detail: { code: "ARTIFACT_REPRODUCIBILITY_MISMATCH" },
    });
    const runs = await fixture.prisma.buildRun.findMany({
      where: { id: { in: [first.id, second.id] } },
      include: { manifest: true },
    });
    expect(runs.filter((run) => run.manifest)).toHaveLength(1);
    const pending = runs.find((run) => run.status === "running");
    if (!pending)
      throw new Error("Divergent BuildRun was not left uncommitted");
    await fixture.results.fail({
      buildRunId: pending.id,
      code: "ARTIFACT_REPRODUCIBILITY_MISMATCH",
      message: "digest mismatch",
      logReference: `build-log://${pending.id}`,
      logSummary: { redacted: true, lines: [] },
      gateSummary: { artifact: { status: "failed" } },
    });
    await expect(
      fixture.prisma.artifactManifest.count({
        where: { buildRunId: { in: [first.id, second.id] } },
      }),
    ).resolves.toBe(1);
  });

  it("uses one ReleaseOrder-to-Project lock order for reserve and publish", async () => {
    const publishing = await fixture.repository.reserve(
      await fixture.reservation("publishing-input"),
    );
    const reserving = await fixture.reservation("concurrent-reserve-input");
    const [published, reserved] = await Promise.all([
      fixture.results.succeed(
        await completed(publishing, `sha256:${"c".repeat(64)}`),
      ),
      fixture.repository.reserve(reserving),
    ]);
    expect(published.status).toBe("succeeded");
    expect(reserved.status).toBe("running");
    await fixture.results.fail({
      buildRunId: reserved.id,
      code: "TEST_CLEANUP",
      message: "cleanup",
      logReference: `build-log://${reserved.id}`,
      logSummary: { redacted: true, lines: [] },
      gateSummary: { build: { status: "failed" } },
    });
  });

  async function completed(
    run: {
      id: string;
      sourceBranch: string;
      sourceCommitSha: string;
      inputHash: string;
    },
    digest: string,
  ) {
    return {
      buildRunId: run.id,
      teamId: fixture.teamId,
      projectId: fixture.projectId,
      releaseOrderId: fixture.orderId,
      digest,
      uri: `release-artifact://${run.id}/bundle.zip`,
      sizeBytes: 1,
      items: [],
      contentIndex: [],
      sourceBranch: run.sourceBranch,
      sourceCommitSha: run.sourceCommitSha,
      inputHash: run.inputHash,
      repositoryIdentityId: fixture.identityId,
      repositoryIdentityRevisionId: fixture.identityRevisionId,
      repositoryProvider: "generic",
      canonicalRepositoryUrl: "https://example.com/repo",
      logReference: `build-log://${run.id}`,
      logSummary: { redacted: true, lines: ["ok"] },
      gateSummary: { build: { status: "passed" } },
      actorId: fixture.userId,
      gateDecision: await fixture.postBuildDecision(),
    };
  }
});
