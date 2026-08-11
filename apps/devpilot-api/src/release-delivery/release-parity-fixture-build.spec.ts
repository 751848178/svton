import { ConfigService } from "@nestjs/config";
import { execFile } from "node:child_process";
import {
  cp,
  mkdtemp,
  realpath,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { LocalReleaseBuildExecutorService } from "./local-release-build-executor.service";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import type { ReleaseBuildExecutionInput } from "./release-build.types";
import { releaseBuildEvidenceStubs } from "./release-build-executor-evidence.spec-utils";

const git = promisify(execFile);

// F454 (b): the committed parity fixture monorepo really builds under the
// controlled-local-acceptance-v2 executor. This legacy artifact-contract spec
// committed fixtures/parity-app files into a temp work root, pins them as a
// real git checkout, and runs the REAL LocalReleaseBuildExecutorService with
// the exact buildCommand/artifactPaths contract the parity seed declares.
// The full booted-stack runtime verification (API -> git -> executor ->
// Manifest) is additionally exercised at runtime (see F454 evidence).
describe("F454 parity fixture artifact build under the v2 runtime", () => {
  const workRoot = join(tmpdir(), "parity-fixture-build");
  const checkoutRoot = join(workRoot, "devpilot-release-build-parity-fixture");
  const artifactRoot = join(tmpdir(), "parity-fixture-artifacts");
  const fixtureSource = resolve(__dirname, "../../../../fixtures/parity-app");

  let runtime: ReleaseBuildRuntimeProfileService;
  let executor: LocalReleaseBuildExecutorService;
  let canonicalCheckoutRoot: string;

  beforeAll(async () => {
    await rm(workRoot, { recursive: true, force: true });
    await rm(artifactRoot, { recursive: true, force: true });
    await cp(fixtureSource, checkoutRoot, { recursive: true });
    await git("git", ["init", "-q", "-b", "main", checkoutRoot]);
    await git("git", ["-C", checkoutRoot, "config", "user.email", "parity@fixture.local"]);
    await git("git", ["-C", checkoutRoot, "config", "user.name", "Parity Fixture"]);
    await git("git", ["-C", checkoutRoot, "add", "-A"]);
    await git("git", ["-C", checkoutRoot, "commit", "-q", "-m", "parity fixture"]);
    // macOS /var -> /private/var symlink: resolve the canonical path so
    // assertConfinedRoot's realpath comparison matches the runtime work root.
    // The checkout must be a STRICT subdirectory of workRoot (the executor
    // rejects child === "").
    canonicalCheckoutRoot = await realpath(checkoutRoot);
    await rm(artifactRoot, { recursive: true, force: true });
    await cp(fixtureSource, artifactRoot, { recursive: true });
    const canonicalArtifactRoot = await realpath(artifactRoot);
    const nodeBin = dirname(process.execPath);
    const config = new ConfigService({
      RELEASE_BUILD_EXECUTION_ENABLED: true,
      RELEASE_BUILD_EXECUTOR_PROFILE: "controlled-local-acceptance-v2",
      RELEASE_BUILD_WORK_ROOT: await realpath(workRoot),
      RELEASE_BUILD_ARTIFACT_ROOT: canonicalArtifactRoot,
      // The fixture builds run plain `node scripts/build.mjs`; put the
      // host node bin on the child PATH (the container uses /usr/local/bin).
      RELEASE_BUILD_COMMAND_PATH: `${nodeBin}:/usr/local/bin:/usr/bin:/bin`,
    });
    runtime = new ReleaseBuildRuntimeProfileService(config);
    const evidence = releaseBuildEvidenceStubs();
    executor = new LocalReleaseBuildExecutorService(
      runtime,
      new ReleaseBuildArtifactService(config),
      evidence.packages,
      evidence.scanners,
    );
    runtime.assertAvailable();
  });

  afterAll(async () => {
    await Promise.all([
      rm(workRoot, { recursive: true, force: true }),
      rm(artifactRoot, { recursive: true, force: true }),
    ]);
  });

  it("builds the web and api apps into a Manifest with declared outputs", async () => {
    const input: ReleaseBuildExecutionInput = {
      buildRunId: "parity-fixture-build-0001",
      projectId: "parity-project-0001",
      releaseOrderId: "parity-order-0001",
      sourceCommitSha: "a".repeat(40),
      checkoutRoot: canonicalCheckoutRoot,
      components: [
        {
          key: "parity-svc-web",
          name: "web/web",
          workingDirectory: "apps/web",
          buildCommand: "node scripts/build.mjs",
          artifactOutputs: ["apps/web/dist"],
          buildEnvironment: {},
        },
        {
          key: "parity-svc-api",
          name: "api/api",
          workingDirectory: "apps/api",
          buildCommand: "node scripts/build.mjs",
          artifactOutputs: ["apps/api/dist"],
          buildEnvironment: {},
        },
      ],
    };
    const result = await executor.execute(input);
    expect(result.artifact.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.artifact.items).toHaveLength(2);
    const webHtml = await readFile(
      join(checkoutRoot, "apps/web/dist/index.html"),
      "utf8",
    );
    expect(webHtml).toContain("Parity Web");
    const apiJs = await readFile(
      join(checkoutRoot, "apps/api/dist/server.js"),
      "utf8",
    );
    expect(apiJs).toContain("createServer");
    const logs = result.logs.join("\n");
    expect(logs).toContain("[parity-web] wrote dist/index.html");
    expect(logs).toContain("[parity-api] copied src/server.js -> dist/server.js");
    expect(result.gateSummary.build).toMatchObject({ status: "passed" });
  });
});
