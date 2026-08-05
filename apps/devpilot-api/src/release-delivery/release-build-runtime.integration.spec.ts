import "reflect-metadata";
import { ReleaseBuildRuntimeSupervisorService } from "./release-build-runtime-supervisor.service";
import { ReleaseBuildRuntimeFixture } from "./release-build-runtime.integration-fixture";

const describeIntegration =
  process.env.RUN_F426_BUILD_RUNTIME_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("F426 Build runtime persistence", () => {
  const fixture = new ReleaseBuildRuntimeFixture();

  beforeAll(() => fixture.start());
  afterAll(() => fixture.stop());

  it("allocates unique contiguous revisions under real concurrency", async () => {
    const reservations = await Promise.all(
      Array.from({ length: 4 }, () => fixture.reservation()),
    );
    const runs = await Promise.all(
      reservations.map((input) => fixture.repository.reserve(input)),
    );
    expect(runs.map((run) => run.revision).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(new Set(runs.map((run) => run.id)).size).toBe(4);
  });

  it("persists timeout, cancellation and failure as independent terminal runs", async () => {
    const runs = await Promise.all([reserve(), reserve(), reserve()]);
    await fixture.results.fail(failure(runs[0].id, "BUILD_RUN_TIMEOUT"));
    await fixture.results.fail({
      ...failure(runs[1].id, "BUILD_COMMAND_CANCELED"),
      status: "canceled",
    });
    await fixture.results.fail(failure(runs[2].id, "BUILD_COMMAND_FAILED"));
    const stored = await Promise.all(
      runs.map((run) =>
        fixture.prisma.buildRun.findUniqueOrThrow({ where: { id: run.id } }),
      ),
    );
    expect(stored.map((run) => [run.status, run.errorCode])).toEqual([
      ["failed", "BUILD_RUN_TIMEOUT"],
      ["canceled", "BUILD_COMMAND_CANCELED"],
      ["failed", "BUILD_COMMAND_FAILED"],
    ]);
    await expect(
      fixture.prisma.artifactManifest.count({
        where: { buildRunId: { in: runs.map((run) => run.id) } },
      }),
    ).resolves.toBe(0);
  });

  it("allows only one terminal writer to win cancel versus success", async () => {
    const run = await reserve();
    await Promise.allSettled([
      fixture.results.cancelActive(run.id),
      fixture.results.succeed(success(run)),
    ]);
    const stored = await fixture.prisma.buildRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { manifest: true },
    });
    expect(["canceled", "succeeded"]).toContain(stored.status);
    expect(stored.manifest === null).toBe(stored.status === "canceled");
  });

  it("persists cancellation for an orphaned queued run", async () => {
    const run = await reserve();
    await fixture.prisma.buildRun.update({
      where: { id: run.id },
      data: { status: "queued", startedAt: null },
    });
    await fixture.results.cancelActive(run.id);
    await expect(
      fixture.prisma.buildRun.findUniqueOrThrow({ where: { id: run.id } }),
    ).resolves.toMatchObject({
      status: "canceled",
      errorCode: "BUILD_COMMAND_CANCELED",
    });
  });

  it("persists a whole-run deadline before ignored work settles", async () => {
    const run = await reserve();
    const ignored = deferred();
    const supervisor = new ReleaseBuildRuntimeSupervisorService({
      maxConcurrency: 1,
      runTimeoutMs: 20,
    } as never);
    const execution = supervisor.run(async (scope) => {
      await scope.bind(run.id, async () => {
        await fixture.results.fail(failure(run.id, "BUILD_RUN_TIMEOUT"));
      });
      await ignored.promise;
    });
    await expect(execution).rejects.toMatchObject({
      name: "ReleaseBuildRunTimeoutError",
    });
    await expect(
      fixture.prisma.buildRun.findUniqueOrThrow({ where: { id: run.id } }),
    ).resolves.toMatchObject({
      status: "failed",
      errorCode: "BUILD_RUN_TIMEOUT",
    });
    ignored.resolve();
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  });

  it("recovers an interrupted run once without creating a Manifest", async () => {
    const run = await reserve();
    await fixture.recovery.recoverInterrupted();
    await fixture.recovery.recoverInterrupted();
    await expect(
      fixture.prisma.buildRun.findUniqueOrThrow({
        where: { id: run.id },
      }),
    ).resolves.toMatchObject({
      status: "failed",
      errorCode: "BUILD_EXECUTOR_RESTARTED",
    });
    await expect(
      fixture.prisma.artifactManifest.count({
        where: { buildRunId: run.id },
      }),
    ).resolves.toBe(0);
  });

  async function reserve() {
    return fixture.repository.reserve(await fixture.reservation());
  }

  function failure(buildRunId: string, code: string) {
    return {
      buildRunId,
      code,
      message: code,
      logReference: `build-log://${buildRunId}`,
      logSummary: { redacted: true, lines: [] },
      gateSummary: { build: { status: "failed" } },
    };
  }

  function success(run: {
    id: string;
    sourceBranch: string;
    sourceCommitSha: string;
    inputHash: string;
  }) {
    return {
      buildRunId: run.id,
      teamId: fixture.teamId,
      projectId: fixture.projectId,
      releaseOrderId: fixture.orderId,
      digest: `sha256:${"b".repeat(64)}`,
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
    };
  }
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
