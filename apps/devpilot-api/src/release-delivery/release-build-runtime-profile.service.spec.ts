import { ConfigService } from "@nestjs/config";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import { expectedReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";
import { launcherControlsDigest, signLauncherProof } from "./release-build-launcher-proof.policy";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("ReleaseBuildRuntimeProfileService", () => {
  it("requires both the kill switch and the exact controlled profile", () => {
    const disabled = profile({ RELEASE_BUILD_EXECUTION_ENABLED: false });
    expect(() => disabled.assertAvailable()).toThrow();
    const missingProfile = profile({ RELEASE_BUILD_EXECUTION_ENABLED: true });
    expect(() => missingProfile.assertAvailable()).toThrow();
  });

  it("keeps legacy v1 unavailable", () => {
    const runtime = profile({
      RELEASE_BUILD_EXECUTION_ENABLED: true,
      RELEASE_BUILD_EXECUTOR_PROFILE: "controlled-local-v1",
    });
    expect(() => runtime.assertAvailable()).toThrow();
  });

  it("rejects v2 when no untrusted worker provider is configured", () => {
    const runtime = profile({
      RELEASE_BUILD_EXECUTION_ENABLED: true,
      RELEASE_BUILD_EXECUTOR_PROFILE: "controlled-local-acceptance-v2",
    });
    expect(() => runtime.assertAvailable()).toThrow(
      "缺少可证明隔离的非可信源码 Build Worker Provider",
    );
  });

  it("accepts v2 only with a live exact-image external OCI launcher", () => {
    const proof = supplyProof();
    const launcher = launcherProof();
    const runtime = profile({
      RELEASE_BUILD_EXECUTION_ENABLED: true,
      RELEASE_BUILD_EXECUTOR_PROFILE: "controlled-local-acceptance-v2",
      RELEASE_BUILD_WORK_ROOT: "/tmp/devpilot-f426/work",
      RELEASE_BUILD_ARTIFACT_ROOT: "/tmp/devpilot-f426/artifacts",
      RELEASE_BUILD_UNTRUSTED_WORKER_PROVIDER:
        "external-oci-launcher-v1",
      RELEASE_BUILD_WORKER_INPUT_ROOT: "/tmp/devpilot-f426/input",
      RELEASE_BUILD_WORKER_OUTPUT_ROOT: "/tmp/devpilot-f426/output",
      RELEASE_BUILD_WORKER_HMAC_SECRET_FILE: launcher.secretFile,
      RELEASE_BUILD_LAUNCHER_PROOF_FILE: launcher.proofFile,
      RELEASE_BUILD_LAUNCHER_JOB_IMAGE: launcher.image,
      RELEASE_BUILD_SUPPLY_PROOF_FILE: proof,
      RELEASE_BUILD_RUN_TIMEOUT_MS: 180_000,
      RELEASE_BUILD_COMMAND_TIMEOUT_MS: 120_000,
      RELEASE_BUILD_CANCEL_GRACE_MS: 5_000,
      RELEASE_BUILD_MAX_CONCURRENCY: 2,
    });
    expect(() => runtime.assertAvailable()).not.toThrow();
    expect(runtime.descriptor()).toEqual(expect.objectContaining({
      profile: "controlled-local-acceptance-v2",
        profileVersion: 4,
        runnerVersion: "release-build-runner-v4",
      runTimeoutMs: 180_000,
      commandTimeoutMs: 120_000,
      cancelGraceMs: 5_000,
      maxConcurrency: 2,
      concurrencyScope: "single-process",
      workspacePolicy: "dedicated-build-root",
      workerIsolation: {
        contractVersion: "release-build-untrusted-worker-v1",
        provider: "external-oci-launcher-v1",
        untrustedRepositories: true,
      },
      environmentKeys: ["CI", "HOME", "LANG", "LC_ALL", "PATH", "TMPDIR"],
      scannerRules: expect.arrayContaining([
        expect.objectContaining({ id: "secretScan" }),
        expect.objectContaining({ id: "sast" }),
        expect.objectContaining({ id: "vulnerabilities" }),
      ]),
    }));
    expect(JSON.stringify(runtime.descriptor())).not.toContain("/tmp/");
    const stale = new Date(Date.now() - 31_000).toISOString();
    writeFileSync(launcher.proofFile, JSON.stringify(signLauncherProof({
      schemaVersion: 1, provider: "external-oci-launcher-v1",
      profileId: "controlled-local-acceptance-v2", jobImage: launcher.image,
      controlsDigest: launcherControlsDigest, launcherInstanceId: "launcher_instance_01",
      startedAt: stale, heartbeatAt: stale,
    }, launcher.secret)), { mode: 0o600 });
    expect(() => runtime.assertAvailable()).toThrow(
      "缺少可证明隔离的非可信源码 Build Worker Provider",
    );
  });

  it("rejects overlapping work and artifact roots", () => {
    const runtime = profile({
      RELEASE_BUILD_EXECUTION_ENABLED: true,
      RELEASE_BUILD_EXECUTOR_PROFILE: "controlled-local-acceptance-v2",
      RELEASE_BUILD_WORK_ROOT: "/tmp/devpilot-f426",
      RELEASE_BUILD_ARTIFACT_ROOT: "/tmp/devpilot-f426/artifacts",
    });
    expect(() => runtime.assertAvailable()).toThrow();
  });
});

function launcherProof() {
  const root = mkdtempSync(join(tmpdir(), "release-build-launcher-proof-"));
  temporaryRoots.push(root);
  const secretFile = join(root, "secret");
  const proofFile = join(root, "proof.json");
  const secret = "runtime-profile-launcher-secret-32-bytes";
  const image = `registry.example.test/devpilot/api@sha256:${"a".repeat(64)}`;
  writeFileSync(secretFile, secret, { mode: 0o600 });
  const now = new Date().toISOString();
  writeFileSync(proofFile, JSON.stringify(signLauncherProof({
    schemaVersion: 1, provider: "external-oci-launcher-v1",
    profileId: "controlled-local-acceptance-v2", jobImage: image,
    controlsDigest: launcherControlsDigest, launcherInstanceId: "launcher_instance_01",
    startedAt: now, heartbeatAt: now,
  }, secret)), { mode: 0o600 });
  return { secretFile, proofFile, image, secret };
}

function supplyProof() {
  const root = mkdtempSync(join(tmpdir(), "release-build-supply-proof-"));
  temporaryRoots.push(root);
  const file = join(root, "proof.json");
  const profile = resolveRegisteredReleaseBuildProfile("controlled-local-acceptance-v2");
  if (!profile) throw new Error("registered acceptance profile missing");
  writeFileSync(file, JSON.stringify(expectedReleaseBuildSupplyProof(profile)), { mode: 0o600 });
  return file;
}

function profile(overrides: Record<string, unknown>) {
  const values = {
    RELEASE_BUILD_WORK_ROOT: "/tmp/devpilot-f426/work",
    RELEASE_BUILD_ARTIFACT_ROOT: "/tmp/devpilot-f426/artifacts",
    ...overrides,
  };
  const config = {
    get: jest.fn((key: string) => values[key as keyof typeof values]),
  } as unknown as ConfigService;
  return new ReleaseBuildRuntimeProfileService(config);
}
