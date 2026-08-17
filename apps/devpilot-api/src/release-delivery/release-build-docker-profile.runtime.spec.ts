import { ConfigService } from "@nestjs/config";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { envSchema } from "../common/config/env.schema";
import { LocalReleaseBuildExecutorService } from "./local-release-build-executor.service";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { runControlledBuildCommand } from "./release-build-command-runner";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import { ReleaseBuildRuntimeSupervisorService } from "./release-build-runtime-supervisor.service";
import { releaseBuildEvidenceStubs } from "./release-build-executor-evidence.spec-utils";

const describeRuntime =
  process.env.RUN_F426_DOCKER_PROFILE === "1" ? describe : describe.skip;

describeRuntime("F426 V13 Docker runtime profile", () => {
  let runtime: ReleaseBuildRuntimeProfileService;
  let executor: LocalReleaseBuildExecutorService;
  const roots: string[] = [];

  beforeAll(async () => {
    const config = new ConfigService(envSchema.parse(process.env));
    runtime = new ReleaseBuildRuntimeProfileService(config);
    const evidence = releaseBuildEvidenceStubs();
    executor = new LocalReleaseBuildExecutorService(
      runtime,
      new ReleaseBuildArtifactService(config),
      evidence.packages,
      evidence.preScript,
    );
    runtime.assertAvailable();
    await mkdir(runtime.workRoot, { recursive: true });
  });

  afterAll(async () => {
    await Promise.all(
      roots.map((root) => rm(root, { recursive: true, force: true })),
    );
    await rm(join(runtime.artifactRoot, "docker-project"), {
      recursive: true,
      force: true,
    });
  });

  it("executes under the configured volume without API secrets in child env", async () => {
    const root = await checkout();
    await writeFile(
      join(root, "build.js"),
      [
        "const fs = require('fs')",
        "fs.mkdirSync('dist', { recursive: true })",
        "fs.writeFileSync('dist/app.js', 'built')",
        "console.log('DATABASE_URL=' + (process.env.DATABASE_URL || 'absent'))",
        "console.log('HOME=' + process.env.HOME)",
        "console.log('TMPDIR=' + process.env.TMPDIR)",
        "console.log('PATH=' + process.env.PATH)",
      ].join(";"),
    );
    const result = await executor.execute(
      input(root, "docker-happy", "node build.js"),
    );
    expect(root.startsWith(`${runtime.workRoot}/`)).toBe(true);
    expect(result.logs.join("\n")).toContain("DATABASE_URL=[REDACTED]");
    expect(result.logs.join("\n")).not.toContain(
      String(process.env.DATABASE_URL),
    );
    expect(result.logs.join("\n")).toContain(
      `${runtime.workRoot}/runtime/docker-happy`,
    );
    expect(result.logs.join("\n")).toContain(`PATH=${runtime.commandPath}`);
    expect(result.artifact.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("cancels a real process group and cleans its runtime directory", async () => {
    const root = await checkout();
    const controller = new AbortController();
    const running = executor.execute(
      input(root, "docker-cancel", 'node -e "setTimeout(() => {}, 30000)"'),
      controller.signal,
    );
    setTimeout(() => controller.abort(), 100);
    await expect(running).rejects.toMatchObject({
      detail: { code: "BUILD_COMMAND_CANCELED", status: "canceled" },
    });
  });

  it("records a distinct timeout from a real process group", async () => {
    const root = await checkout();
    await expect(
      executor.execute(
        input(root, "docker-timeout", 'node -e "setTimeout(() => {}, 30000)"'),
      ),
    ).rejects.toMatchObject({
      detail: { code: "BUILD_COMMAND_TIMEOUT", status: "failed" },
    });
  });

  it("caps four real commands at the configured concurrency", async () => {
    const supervisor = new ReleaseBuildRuntimeSupervisorService(runtime);
    let active = 0;
    let maximum = 0;
    const outcomes = await Promise.all(
      Array.from({ length: 4 }, () =>
        supervisor.run(async () => {
          active += 1;
          maximum = Math.max(maximum, active);
          try {
            return (
              await runControlledBuildCommand({
                command: 'node -e "setTimeout(() => {}, 200)"',
                cwd: runtime.workRoot,
                env: { PATH: runtime.commandPath },
                timeoutMs: runtime.commandTimeoutMs,
                cancelGraceMs: runtime.cancelGraceMs,
              })
            ).kind;
          } finally {
            active -= 1;
          }
        }),
      ),
    );
    expect(maximum).toBe(2);
    expect(outcomes).toEqual([
      "completed",
      "completed",
      "completed",
      "completed",
    ]);
  });

  async function checkout() {
    const root = await mkdtemp(join(runtime.workRoot, "docker-profile-"));
    roots.push(root);
    return root;
  }
});

function input(root: string, buildRunId: string, buildCommand: string) {
  return {
    buildRunId,
    projectId: "docker-project",
    releaseOrderId: "docker-order",
    sourceCommitSha: "a".repeat(40),
    checkoutRoot: root,
    components: [
      {
        key: "app",
        name: "app",
        workingDirectory: ".",
        buildCommand,
        artifactOutputs: ["dist"],
        buildEnvironment: {},
      },
    ],
  };
}
