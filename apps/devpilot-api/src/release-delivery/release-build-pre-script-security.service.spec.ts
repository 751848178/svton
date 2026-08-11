import { execFile } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { ReleaseBuildPreScriptSecurityService } from "./release-build-pre-script-security.service";
import { ReleaseBuildSourceSnapshotService } from "./release-build-source-snapshot.service";

const exec = promisify(execFile);

describe("pre-script immutable source security", () => {
  let scope: string;
  let workRoot: string;
  let sourceRoot: string;
  let runtimeRoot: string;
  let commit: string;

  beforeEach(async () => {
    scope = await mkdtemp(join(tmpdir(), "release-pre-script-"));
    workRoot = join(scope, "work");
    sourceRoot = join(workRoot, "source");
    runtimeRoot = join(workRoot, "runtime", "run-1");
    await Promise.all([
      mkdir(sourceRoot, { recursive: true }),
      mkdir(runtimeRoot, { recursive: true }),
    ]);
    await writeFile(join(sourceRoot, "source.ts"), "export const safe = true;\n");
    await git(["init", "-q"]);
    await git(["config", "user.email", "fixture@example.test"]);
    await git(["config", "user.name", "Fixture"]);
    await git(["add", "."]);
    await git(["commit", "-q", "-m", "fixture"]);
    commit = (await git(["rev-parse", "HEAD"])).trim();
  });

  afterEach(async () => rm(scope, { recursive: true, force: true }));

  it("scans the clean exact commit before creating a separate build copy", async () => {
    const scanners = {
      execute: jest.fn().mockImplementation(async () => {
        await expect(access(join(runtimeRoot, "workspace"))).rejects.toThrow();
        return passedSecurity();
      }),
    };
    const service = new ReleaseBuildPreScriptSecurityService(
      new ReleaseBuildSourceSnapshotService(),
      scanners as never,
    );
    const result = await service.prepare(input());
    expect(result.buildRoot).not.toBe(sourceRoot);
    await expect(readFile(join(result.buildRoot, "source.ts"), "utf8"))
      .resolves.toContain("safe = true");
    expect(result.sourceSnapshot).toMatchObject({
      sourceCommitSha: commit,
      snapshotDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("does not create a build workspace when a scanner is unavailable", async () => {
    const scanners = { execute: jest.fn().mockResolvedValue({
      ...passedSecurity(),
      secretScan: { status: "unavailable", reasonCode: "tool_missing" },
    }) };
    const service = new ReleaseBuildPreScriptSecurityService(
      new ReleaseBuildSourceSnapshotService(),
      scanners as never,
    );
    await expect(service.prepare(input())).rejects.toMatchObject({
      detail: { code: "BUILD_PRE_SCRIPT_SECURITY_BLOCKED" },
    });
    await expect(access(join(runtimeRoot, "workspace"))).rejects.toThrow();
  });

  it("rejects scanner mutation of the immutable source snapshot", async () => {
    const scanners = { execute: jest.fn().mockImplementation(async () => {
      await writeFile(join(sourceRoot, "source.ts"), "mutated");
      return passedSecurity();
    }) };
    const service = new ReleaseBuildPreScriptSecurityService(
      new ReleaseBuildSourceSnapshotService(),
      scanners as never,
    );
    await expect(service.prepare(input())).rejects.toMatchObject({
      detail: { code: "BUILD_SOURCE_SNAPSHOT_DRIFT" },
    });
    await expect(access(join(runtimeRoot, "workspace"))).rejects.toThrow();
  });

  it("rejects a dirty exact-commit snapshot before scanners run", async () => {
    await writeFile(join(sourceRoot, "untracked.txt"), "drift");
    const scanners = { execute: jest.fn() };
    const service = new ReleaseBuildPreScriptSecurityService(
      new ReleaseBuildSourceSnapshotService(),
      scanners as never,
    );
    await expect(service.prepare(input())).rejects.toMatchObject({
      detail: { code: "BUILD_SOURCE_SNAPSHOT_DRIFT" },
    });
    expect(scanners.execute).not.toHaveBeenCalled();
  });

  function input() {
    return {
      projectId: "project-1", releaseOrderId: "order-1", buildRunId: "run-1",
      sourceCommitSha: commit, sourceRoot, runtimeRoot, workRoot,
      profile: { scanners: [] } as never,
      env: { PATH: process.env.PATH, HOME: join(runtimeRoot, "home") },
      timeoutMs: 5_000, cancelGraceMs: 50,
    };
  }

  async function git(args: string[]) {
    return (await exec("/usr/bin/git", args, { cwd: sourceRoot })).stdout;
  }
});

function passedSecurity() {
  const passed = { status: "passed", reasonCode: "passed" };
  return { secretScan: passed, sast: passed, vulnerabilities: passed };
}
