import { ConfigService } from "@nestjs/config";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalReleaseBuildExecutorService } from "./local-release-build-executor.service";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";

describe("LocalReleaseBuildExecutorService", () => {
  let scope: string;
  let checkout: string;
  let executor: LocalReleaseBuildExecutorService;

  beforeEach(async () => {
    scope = await mkdtemp(join(tmpdir(), "release-build-spec-"));
    checkout = join(scope, "checkout");
    await mkdir(checkout);
    const config = {
      get: jest.fn((key: string) => ({
        RELEASE_BUILD_EXECUTION_ENABLED: true,
        RELEASE_BUILD_COMMAND_TIMEOUT_MS: 5_000,
        RELEASE_BUILD_ARTIFACT_ROOT: join(scope, "artifacts"),
      }[key])),
    } as unknown as ConfigService;
    executor = new LocalReleaseBuildExecutorService(
      config,
      new ReleaseBuildArtifactService(config),
    );
  });

  afterEach(async () => rm(scope, { recursive: true, force: true }));

  it("packages a real checkout and redacts sensitive command output", async () => {
    await writeFile(join(checkout, "emit.js"), [
      "require('fs').mkdirSync('dist', { recursive: true })",
      "require('fs').writeFileSync('dist/app.js', 'built')",
      "console.log('Authorization: Bearer ghp_12345678901234567890')",
    ].join(";"));
    const result = await executor.execute(input(checkout, "node emit.js"));
    expect(result.artifact.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.artifact.sizeBytes).toBeGreaterThan(0);
    expect(result.logs.join("\n")).toContain("[REDACTED_TOKEN]");
    expect(result.logs.join("\n")).not.toContain("ghp_12345678901234567890");
    expect(result.gateSummary).toEqual(expect.objectContaining({
      security: expect.objectContaining({
        executionControls: expect.objectContaining({ status: "passed" }),
      }),
    }));
    const replay = await executor.execute({
      ...input(checkout, "node emit.js"),
      buildRunId: "run-2",
    });
    expect(replay.artifact.digest).toBe(result.artifact.digest);
  });

  it("fails before execution when a workdir symlink escapes the checkout", async () => {
    const outside = join(scope, "outside");
    await mkdir(outside);
    await symlink(outside, join(checkout, "escape"));
    const escaped = input(checkout, "echo should-not-run");
    escaped.components[0].workingDirectory = "escape";
    await expect(executor.execute(escaped)).rejects.toMatchObject({
      detail: { code: "BUILD_WORKDIR_OUTSIDE_CHECKOUT" },
    });
  });
});

function input(checkoutRoot: string, command: string) {
  return {
    buildRunId: "run-1",
    projectId: "project-1",
    releaseOrderId: "order-1",
    checkoutRoot,
    components: [{
      key: "application-1",
      name: "api",
      workingDirectory: ".",
      buildCommand: command,
    }],
  };
}
