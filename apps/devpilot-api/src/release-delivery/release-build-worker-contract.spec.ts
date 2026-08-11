import { execFile } from "node:child_process";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  signWorkerCancellation,
  signWorkerRequest,
  signWorkerResult,
  verifyWorkerCancellation,
  verifyWorkerRequest,
  verifyWorkerResult,
  type ReleaseBuildWorkerIdentity,
} from "./release-build-worker-envelope.policy";
import {
  readImmutableWorkerJson,
  workerJobDirectory,
  writeImmutableWorkerJson,
} from "./release-build-worker-exchange";
import { createWorkerSourceArchive } from "./release-build-worker-source-archive";
import { verifyExtractedWorkerSource } from "./release-build-worker-source-manifest";

const exec = promisify(execFile);
const secret = "fixture-shared-secret-that-is-at-least-32-bytes";

describe("filesystem isolated worker contract", () => {
  let scope: string;
  beforeEach(async () => { scope = await mkdtemp(join(tmpdir(), "worker-contract-")); });
  afterEach(async () => rm(scope, { recursive: true, force: true }));

  it("derives role-separated HMACs and detects tampering", () => {
    const request = signWorkerRequest({
      version: 1, identity: identity(), components: [],
      sourceManifest: { version: 1, entries: [], digest: "manifest" },
    }, secret);
    const result = signWorkerResult({
      version: 1, identity: identity(), status: "failed",
      error: { code: "fixture", message: "fixture" },
    }, secret);
    const cancel = signWorkerCancellation({
      version: 1, identity: identity(), reason: "canceled",
      requestedAt: new Date(0).toISOString(),
    }, secret);
    expect(verifyWorkerRequest(request, secret)).toBe(true);
    expect(verifyWorkerResult(result, secret)).toBe(true);
    expect(verifyWorkerCancellation(cancel, secret)).toBe(true);
    expect(request.signature).not.toBe(result.signature);
    expect(verifyWorkerRequest({ ...request, components: [{ key: "tampered" }] as never }, secret))
      .toBe(false);
  });

  it("uses bounded no-follow atomic files with shared-group permissions", async () => {
    const root = join(scope, "exchange");
    const directory = await workerJobDirectory(root, "job-12345678", true);
    const target = await writeImmutableWorkerJson(directory, "request.json", { ok: true });
    expect((await lstat(directory)).mode & 0o777).toBe(0o750);
    expect((await lstat(target)).mode & 0o777).toBe(0o640);
    await expect(readImmutableWorkerJson(target)).resolves.toEqual({ ok: true });
    await expect(writeImmutableWorkerJson(directory, "request.json", { ok: false }))
      .rejects.toMatchObject({ code: "EEXIST" });
    const outside = join(scope, "outside.json");
    await writeFile(outside, "{}");
    await symlink(outside, join(directory, "result.json"));
    await expect(readImmutableWorkerJson(join(directory, "result.json")))
      .rejects.toBeDefined();
  });

  it("archives only the exact Git tree and verifies path, mode, size and sha256", async () => {
    const repository = join(scope, "repository");
    const jobs = join(scope, "jobs");
    await Promise.all([mkdir(repository), mkdir(jobs)]);
    await writeFile(join(repository, "plain.txt"), "plain\n");
    await writeFile(join(repository, "run.sh"), "#!/bin/sh\n", { mode: 0o755 });
    await chmod(join(repository, "run.sh"), 0o755);
    await symlink("plain.txt", join(repository, "link.txt"));
    await git(repository, ["init", "-q"]);
    await git(repository, ["config", "user.email", "fixture@example.test"]);
    await git(repository, ["config", "user.name", "Fixture"]);
    await git(repository, ["add", "."]);
    await git(repository, ["commit", "-q", "-m", "fixture"]);
    const commit = (await git(repository, ["rev-parse", "HEAD"])).trim();
    const archive = await createWorkerSourceArchive({
      checkoutRoot: repository, sourceCommitSha: commit, jobDirectory: jobs,
      env: { PATH: process.env.PATH }, timeoutMs: 5_000, cancelGraceMs: 50,
    });
    expect(archive.manifest.entries.map((entry) => [entry.path, entry.mode]))
      .toEqual([["link.txt", "120000"], ["plain.txt", "100644"], ["run.sh", "100755"]]);
    expect(archive.manifest.entries.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)))
      .toBe(true);
    const extracted = join(scope, "extracted");
    await mkdir(extracted);
    await exec("/usr/bin/tar", ["-xf", archive.path, "-C", extracted]);
    await expect(verifyExtractedWorkerSource(extracted, archive.manifest))
      .resolves.toBeUndefined();
  });
});

function identity(): ReleaseBuildWorkerIdentity {
  return {
    contract: "filesystem-isolated-worker-v1", jobId: "job-12345678",
    projectId: "project-1", releaseOrderId: "order-1", buildRunId: "build-1",
    sourceCommitSha: "a".repeat(40), sourceTreeHash: "b".repeat(40),
    sourceSnapshotDigest: "c".repeat(64), sourceArchiveDigest: "d".repeat(64),
    sourceManifestDigest: "e".repeat(64), profileId: "controlled-local-acceptance-v2",
    profileVersion: 2, profileSnapshotHash: "f".repeat(64),
    deadline: "2099-01-01T00:00:00.000Z",
  };
}

async function git(cwd: string, args: string[]) {
  return (await exec("/usr/bin/git", args, { cwd })).stdout;
}
