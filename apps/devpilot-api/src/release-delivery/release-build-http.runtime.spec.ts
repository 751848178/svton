import "reflect-metadata";
import type { ReleaseBuildHttpRuntimeFixture } from "./release-build-http-runtime.fixture";

const describeRuntime =
  process.env.RUN_F426_HTTP_RUNTIME === "1" ? describe : describe.skip;

jest.setTimeout(30_000);

describeRuntime("F426 authenticated HTTP Build runtime", () => {
  let fixture: ReleaseBuildHttpRuntimeFixture;

  beforeAll(async () => {
    const { ReleaseBuildHttpRuntimeFixture } =
      await import("./release-build-http-runtime.fixture");
    fixture = new ReleaseBuildHttpRuntimeFixture();
    await fixture.start();
  });
  afterAll(() => fixture.stop());

  it("admits, executes and cancels one exact-commit Build through HTTP", async () => {
    const building = fixture.request(fixture.buildsPath(), { method: "POST" });
    const running = await fixture.waitForRunningBuild();
    const cancel = await fixture.request(
      `${fixture.buildsPath()}/${running.id}/cancel`,
      { method: "POST" },
    );
    expect(cancel.ok).toBe(true);
    const canceledBody = (await cancel.json()) as {
      data: Record<string, unknown>;
    };
    expect(canceledBody.data).toMatchObject({
      id: running.id,
      revision: running.revision,
      status: "canceled",
      errorCode: "BUILD_COMMAND_CANCELED",
      manifest: null,
    });
    await expect(building).resolves.toMatchObject({ ok: false, status: 409 });
    await fixture.waitForCleanup();
    const stored = await fixture.git.prisma.buildRun.findUniqueOrThrow({
      where: { id: running.id },
      include: { manifest: true },
    });
    expect(stored).toMatchObject({
      status: "canceled",
      errorCode: "BUILD_COMMAND_CANCELED",
      manifest: null,
      sourceCommitSha: await fixture.git.revParse("refs/heads/main"),
    });
    expect(stored.inputSnapshot).toMatchObject({
      version: 3,
      runtime: { profile: "controlled-local-v1", maxConcurrency: 2 },
    });
  });
});
