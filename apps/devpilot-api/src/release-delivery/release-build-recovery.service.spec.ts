import { ConfigService } from "@nestjs/config";
import {
  access,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReleaseBuildRecoveryService } from "./release-build-recovery.service";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";

describe("ReleaseBuildRecoveryService", () => {
  let scope: string;

  afterEach(async () => {
    if (scope) await rm(scope, { recursive: true, force: true });
  });

  it("recovers interrupted rows and sweeps only owned workspaces", async () => {
    scope = await mkdtemp(join(tmpdir(), "f426-recovery-"));
    const workRoot = join(scope, "work");
    const artifactRoot = join(scope, "artifacts");
    const stale = join(workRoot, "devpilot-release-build-stale");
    const unrelated = join(workRoot, "keep-me");
    await mkdir(stale, { recursive: true });
    await mkdir(unrelated, { recursive: true });
    await writeFile(join(stale, "marker"), "stale");
    const runtime = new ReleaseBuildRuntimeProfileService(
      config({
        NODE_ENV: "test",
        RELEASE_BUILD_TRUSTED_TEST_FIXTURE: true,
        RELEASE_BUILD_EXECUTION_ENABLED: true,
        RELEASE_BUILD_EXECUTOR_PROFILE: "controlled-local-acceptance-v2",
        RELEASE_BUILD_WORK_ROOT: workRoot,
        RELEASE_BUILD_ARTIFACT_ROOT: artifactRoot,
      }),
    );
    const results = {
      recoverInterrupted: jest.fn().mockResolvedValue({ count: 1 }),
    };
    await new ReleaseBuildRecoveryService(
      runtime,
      results as never,
    ).onApplicationBootstrap();
    expect(results.recoverInterrupted).toHaveBeenCalledTimes(1);
    await expect(access(stale)).rejects.toThrow();
    await expect(access(unrelated)).resolves.toBeUndefined();
    await expect(access(join(workRoot, "runtime"))).resolves.toBeUndefined();
    await expect(access(artifactRoot)).resolves.toBeUndefined();
  });

  it("fails before recovery when canonical roots overlap through a symlink", async () => {
    scope = await mkdtemp(join(tmpdir(), "f426-recovery-alias-"));
    const workRoot = join(scope, "work");
    const artifactRoot = join(scope, "artifact-alias");
    await mkdir(workRoot, { recursive: true });
    await symlink(workRoot, artifactRoot);
    const runtime = new ReleaseBuildRuntimeProfileService(
      config({
        NODE_ENV: "test",
        RELEASE_BUILD_TRUSTED_TEST_FIXTURE: true,
        RELEASE_BUILD_EXECUTION_ENABLED: true,
        RELEASE_BUILD_EXECUTOR_PROFILE: "controlled-local-acceptance-v2",
        RELEASE_BUILD_WORK_ROOT: workRoot,
        RELEASE_BUILD_ARTIFACT_ROOT: artifactRoot,
      }),
    );
    const recovery = { recoverInterrupted: jest.fn() };
    await expect(
      new ReleaseBuildRecoveryService(
        runtime,
        recovery as never,
      ).onApplicationBootstrap(),
    ).rejects.toThrow("roots overlap");
    expect(recovery.recoverInterrupted).not.toHaveBeenCalled();
  });

  it("fails startup when only one side of double consent is configured", async () => {
    const runtime = new ReleaseBuildRuntimeProfileService(
      config({ RELEASE_BUILD_EXECUTION_ENABLED: true }),
    );
    const recovery = { recoverInterrupted: jest.fn() };
    await expect(
      new ReleaseBuildRecoveryService(
        runtime,
        recovery as never,
      ).onApplicationBootstrap(),
    ).rejects.toMatchObject({
      response: { code: "BUILD_EXECUTOR_DISABLED_OR_INVALID" },
    });
    expect(recovery.recoverInterrupted).not.toHaveBeenCalled();
  });
});

function config(values: Record<string, unknown>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}
