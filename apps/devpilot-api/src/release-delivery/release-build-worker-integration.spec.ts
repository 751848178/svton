import { execFile } from "node:child_process";
import { ConfigService } from "@nestjs/config";
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { FilesystemIsolatedReleaseBuildExecutorService } from "./filesystem-isolated-release-build-executor.service";
import { ReleaseBuildFilesystemWorker } from "./release-build-filesystem-worker";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { expectedReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";
import { ReleaseBuildSourceSnapshotService } from "./release-build-source-snapshot.service";
import { readImmutableWorkerJson } from "./release-build-worker-exchange";
import {
  verifyWorkerResult,
  type ReleaseBuildWorkerResult,
} from "./release-build-worker-envelope.policy";

const exec = promisify(execFile);
const secret = "integration-worker-secret-is-at-least-32-bytes";

describe("filesystem isolated build worker exchange", () => {
  let scope: string;

  beforeEach(async () => {
    scope = await mkdtemp(join(tmpdir(), "release-worker-integration-"));
  });
  afterEach(async () => rm(scope, { recursive: true, force: true }));

  it("returns an authenticated fail-closed scan result without running build", async () => {
    const repository = join(scope, "repository");
    const inputRoot = join(scope, "input");
    const outputRoot = join(scope, "output");
    const secretFile = join(scope, "worker.secret");
    const supplyProofFile = join(scope, "supply-proof.json");
    const profile = resolveRegisteredReleaseBuildProfile(
      "controlled-local-acceptance-v2",
    )!;
    await Promise.all([
      mkdir(repository),
      mkdir(inputRoot),
      mkdir(outputRoot),
      writeFile(secretFile, secret, { mode: 0o600 }),
      writeFile(supplyProofFile,
        JSON.stringify(expectedReleaseBuildSupplyProof(profile)), { mode: 0o400 }),
    ]);
    await writeFile(join(repository, "credential.txt"), [
      "-----BEGIN RSA PRIVATE KEY-----",
      "fixture-must-never-reach-repository-scripts",
      "-----END RSA PRIVATE KEY-----",
    ].join("\n"));
    await writeFile(join(repository, "build.js"), "throw new Error('must not run')");
    await git(repository, ["init", "-q"]);
    await git(repository, ["config", "user.email", "fixture@example.test"]);
    await git(repository, ["config", "user.name", "Fixture"]);
    await git(repository, ["add", "."]);
    await git(repository, ["commit", "-q", "-m", "fixture"]);
    const commit = (await git(repository, ["rev-parse", "HEAD"])).trim();
    const runtime = new ReleaseBuildRuntimeProfileService(new ConfigService({
      RELEASE_BUILD_EXECUTION_ENABLED: true,
      RELEASE_BUILD_EXECUTOR_PROFILE: "controlled-local-acceptance-v2",
      RELEASE_BUILD_WORK_ROOT: join(scope, "api-work"),
      RELEASE_BUILD_ARTIFACT_ROOT: join(outputRoot, "artifacts"),
      NODE_ENV: "test",
      RELEASE_BUILD_TRUSTED_TEST_FIXTURE: true,
      RELEASE_BUILD_UNTRUSTED_WORKER_PROVIDER: "external-oci-launcher-v1",
      RELEASE_BUILD_WORKER_INPUT_ROOT: inputRoot,
      RELEASE_BUILD_WORKER_OUTPUT_ROOT: outputRoot,
      RELEASE_BUILD_WORKER_HMAC_SECRET_FILE: secretFile,
      RELEASE_BUILD_SUPPLY_PROOF_FILE: supplyProofFile,
      RELEASE_BUILD_WORKER_SHARED_GID: process.getgid?.() ?? 1,
      RELEASE_BUILD_WORKER_POLL_INTERVAL_MS: 10,
      RELEASE_BUILD_RUN_TIMEOUT_MS: 10_000,
      RELEASE_BUILD_COMMAND_TIMEOUT_MS: 5_000,
      RELEASE_BUILD_COMMAND_PATH: process.env.PATH,
    }));
    const adapter = new FilesystemIsolatedReleaseBuildExecutorService(
      runtime,
      new ReleaseBuildSourceSnapshotService(),
      { prepare: jest.fn().mockResolvedValue({ ...dependency(), leaseToken: "raw" }),
        acceptResult: jest.fn().mockResolvedValue(undefined),
        heartbeat: jest.fn().mockResolvedValue(undefined),
        cancel: jest.fn().mockResolvedValue(undefined) } as never,
    );
    const execution = adapter.execute({
      buildRunId: "build-integration-1",
      projectId: "project-1",
      releaseOrderId: "order-1",
      sourceCommitSha: commit,
      checkoutRoot: repository,
      components: [{
        key: "api", name: "api", workingDirectory: ".",
        buildCommand: "node build.js", artifactOutputs: ["dist"],
        buildEnvironment: {},
      }],
    });
    const failure = expect(execution).rejects.toMatchObject({
      detail: { code: "BUILD_PRE_SCRIPT_SECURITY_BLOCKED" },
    });
    const jobId = await waitForJob(inputRoot);
    const worker = new ReleaseBuildFilesystemWorker({
      inputRoot, outputRoot, secretFile,
      workRoot: join(scope, "worker-work"),
      commandPath: process.env.PATH || "/usr/bin:/bin",
      tarExecutable: "/usr/bin/tar",
      commandTimeoutMs: 5_000,
      cancelGraceMs: 50,
      brokerUid: process.getuid?.() ?? 0,
      brokerGid: process.getgid?.() ?? 0,
    });
    await worker.runJob(jobId);
    await failure;
    const result = await readImmutableWorkerJson<ReleaseBuildWorkerResult>(
      join(outputRoot, jobId, "result.json"),
    );
    expect(verifyWorkerResult(result, secret)).toBe(true);
    expect(result.status).toBe("failed");
  });
});

async function waitForJob(root: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const entries = await readdir(root);
    if (entries.length === 1 && await exists(join(root, entries[0], "request.json"))) {
      return entries[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Build worker request was not published");
}

function dependency() {
  return { fetchRunId: `dep_${"1".repeat(64)}`,
    combinationHash: "1".repeat(64), lockfileDigest: "2".repeat(64),
    profileId: "controlled-local-acceptance-v2", profileVersion: 6,
    profileSnapshotHash: "5".repeat(64), supplyChainDigest: "6".repeat(64),
    fetchImage: `registry.test/api@sha256:${"7".repeat(64)}`,
    jobImage: `registry.test/api@sha256:${"7".repeat(64)}`,
    pnpmVersion: "8.12.0", platformOs: "linux", platformArch: "arm64",
    platformAbi: "node20-modules-115", platformLibc: "glibc-debian-bookworm",
    registryPolicyDigest: "3".repeat(64), mode: "verify_or_fetch",
    storeDigest: "4".repeat(64) } as const;
}

async function exists(path: string) {
  try { await access(path); return true; } catch { return false; }
}

async function git(cwd: string, args: string[]) {
  return (await exec("/usr/bin/git", args, { cwd })).stdout;
}
