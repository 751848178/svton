import { ConfigService } from "@nestjs/config";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";

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

  it("accepts v2 with a distinct filesystem worker exchange", () => {
    const runtime = profile({
      RELEASE_BUILD_EXECUTION_ENABLED: true,
      RELEASE_BUILD_EXECUTOR_PROFILE: "controlled-local-acceptance-v2",
      RELEASE_BUILD_WORK_ROOT: "/tmp/devpilot-f426/work",
      RELEASE_BUILD_ARTIFACT_ROOT: "/tmp/devpilot-f426/artifacts",
      RELEASE_BUILD_UNTRUSTED_WORKER_PROVIDER:
        "filesystem-isolated-worker-v1",
      RELEASE_BUILD_WORKER_INPUT_ROOT: "/tmp/devpilot-f426/input",
      RELEASE_BUILD_WORKER_OUTPUT_ROOT: "/tmp/devpilot-f426/output",
      RELEASE_BUILD_WORKER_HMAC_SECRET_FILE: "/run/secrets/build-worker",
      RELEASE_BUILD_RUN_TIMEOUT_MS: 180_000,
      RELEASE_BUILD_COMMAND_TIMEOUT_MS: 120_000,
      RELEASE_BUILD_CANCEL_GRACE_MS: 5_000,
      RELEASE_BUILD_MAX_CONCURRENCY: 2,
    });
    expect(() => runtime.assertAvailable()).not.toThrow();
    expect(runtime.descriptor()).toEqual(expect.objectContaining({
      profile: "controlled-local-acceptance-v2",
      profileVersion: 2,
      runnerVersion: "release-build-runner-v2",
      runTimeoutMs: 180_000,
      commandTimeoutMs: 120_000,
      cancelGraceMs: 5_000,
      maxConcurrency: 2,
      concurrencyScope: "single-process",
      workspacePolicy: "dedicated-build-root",
      workerIsolation: {
        contractVersion: "release-build-untrusted-worker-v1",
        provider: "filesystem-isolated-worker-v1",
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
