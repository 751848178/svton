import "reflect-metadata";
import type { ReleaseBuildHttpRuntimeFixture } from "./release-build-http-runtime.fixture";

const describeRuntime =
  process.env.RUN_F426_HTTP_RUNTIME === "1" ? describe : describe.skip;

jest.setTimeout(30_000);

describeRuntime("F426 authenticated HTTP Build runtime", () => {
  let fixture: ReleaseBuildHttpRuntimeFixture;

  beforeAll(async () => {
    try {
      const { ReleaseBuildHttpRuntimeFixture } =
        await import("./release-build-http-runtime.fixture");
      fixture = new ReleaseBuildHttpRuntimeFixture();
      await fixture.start();
    } catch (error) {
      throw new Error(
        `HTTP runtime fixture start failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  });
  afterAll(() => fixture?.stop());

  it("builds declared outputs into one provenance-rich Manifest through HTTP", async () => {
    await fixture.configureBuild({
      workingDirectory: ".",
      buildCommand:
        "node -e \"const fs=require('fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/app.js',process.env.NEXT_PUBLIC_API_URL)\"",
      artifactPaths: ["dist"],
      buildEnvironment: {
        NEXT_PUBLIC_API_URL: "https://staging.example",
      },
    });
    const response = await fixture.request(fixture.buildsPath(), {
      method: "POST",
    });
    expect(response.ok).toBe(true);
    const body = (await response.json()) as {
      data: {
        id: string;
        status: string;
        manifest: { id: string };
        errorCode?: string;
        errorMessage?: string;
        logs?: string[];
      };
    };
    if (body.data.status !== "succeeded") {
      throw new Error(`HTTP Build failed: ${JSON.stringify(body.data)}`);
    }
    expect(body.data).toMatchObject({
      status: "succeeded",
      manifest: { id: expect.any(String) },
    });
    const stored = await fixture.git.prisma.buildRun.findUniqueOrThrow({
      where: { id: body.data.id },
      include: { manifest: { include: { items: true } } },
    });
    expect(stored.manifest?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ componentKey: fixture.serviceId }),
        expect.objectContaining({ componentKey: "project-bundle" }),
      ]),
    );
    expect(stored.inputSnapshot).toMatchObject({
      version: 4,
      artifactContract: { collection: "declared-outputs-only" },
    });
    const replayResponse = await fixture.request(fixture.buildsPath(), {
      method: "POST",
    });
    expect(replayResponse.ok).toBe(true);
    const replayBody = (await replayResponse.json()) as {
      data: { id: string };
    };
    const replay = await fixture.git.prisma.buildRun.findUniqueOrThrow({
      where: { id: replayBody.data.id },
      include: { manifest: true },
    });
    expect(replay.inputHash).toBe(stored.inputHash);
    expect(replay.manifest?.digest).toBe(stored.manifest?.digest);
    expect(replay.manifest?.provenance).toMatchObject({
      reproducibility: {
        status: "matched",
        priorManifestId: stored.manifest?.id,
      },
    });
  });

  it("admits, executes and cancels one exact-commit Build through HTTP", async () => {
    await fixture.configureBuild({
      workingDirectory: ".",
      buildCommand: 'node -e "setTimeout(() => {}, 30000)"',
      artifactPaths: ["dist"],
    });
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
      version: 4,
      runtime: { profile: "controlled-local-v1", maxConcurrency: 2 },
      artifactContract: { collection: "declared-outputs-only" },
    });
  });
});
