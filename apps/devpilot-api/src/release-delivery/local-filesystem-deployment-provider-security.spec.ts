import { ConfigService } from "@nestjs/config";
import {
  mkdtemp,
  mkdir,
  lstat,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReleaseArtifactArchivePort } from "./release-artifact-archive.service";
import { LocalFilesystemDeploymentProviderService } from "./local-filesystem-deployment-provider.service";

describe("LocalFilesystemDeploymentProviderService security", () => {
  let scope: string;

  beforeEach(async () => {
    scope = await mkdtemp(join(tmpdir(), "release-provider-security-"));
  });

  afterEach(async () => rm(scope, { recursive: true, force: true }));

  it("rejects the reserved target-control namespace", async () => {
    const provider = createProvider({
      list: jest.fn(async () => [".devpilot/runtime.env"]),
      extract: jest.fn(),
    });
    await expect(provider.deployExactManifest(input())).rejects.toMatchObject({
      detail: { code: "ARTIFACT_ARCHIVE_UNSAFE" },
    });
  });

  it("replaces a malicious component env symlink and enforces 0600 without following it", async () => {
    const attackerTarget = join(scope, "attacker.env");
    await writeFile(attackerTarget, "attacker", { mode: 0o644 });
    const provider = createProvider({
      list: jest.fn(async () => ["dist/app.txt"]),
      extract: jest.fn(async (_archive, target) => {
        await mkdir(join(target, ".devpilot", "env"), {
          recursive: true,
          mode: 0o755,
        });
        await symlink(attackerTarget, join(target, ".devpilot", "env", "api.env"));
        await mkdir(join(target, "dist"), { recursive: true });
        await writeFile(join(target, "dist", "app.txt"), "exact artifact");
      }),
    });
    const receipt = await provider.deployExactManifest(input(true));
    const control = join(
      scope,
      "deployments/project-1/staging-1/releases/deployment-1/.devpilot",
    );
    const environmentFile = join(control, "env", "api.env");
    expect(receipt.evidence.runtimeEnvironmentFileMode).toBe("0600");
    await expect(readFile(environmentFile, "utf8")).resolves.toBe("\n");
    await expect(readFile(attackerTarget, "utf8")).resolves.toBe("attacker");
    expect((await lstat(environmentFile)).isSymbolicLink()).toBe(false);
    expect((await stat(control)).mode & 0o777).toBe(0o700);
    expect((await stat(join(control, "env"))).mode & 0o777).toBe(0o700);
    expect((await stat(environmentFile)).mode & 0o777).toBe(0o600);
  });

  function createProvider(archive: ReleaseArtifactArchivePort) {
    return new LocalFilesystemDeploymentProviderService(
      {
        get: jest.fn((key: string) =>
          key === "RELEASE_STAGING_DEPLOYMENT_ROOT"
            ? join(scope, "deployments")
            : key === "RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS"
              ? 5_000
              : undefined,
        ),
      } as unknown as ConfigService,
      archive,
    );
  }
});

function input(withWorkload = false) {
  return {
    deploymentRunId: "deployment-1",
    stage: "staging" as const,
    projectId: "project-1",
    releaseOrderId: "order-1",
    environmentId: "staging-1",
    targetRef: "filesystem-release-target",
    manifest: {
      id: "manifest-1",
      buildRunId: "build-1",
      uri: "artifact",
      digest: `sha256:${"a".repeat(64)}`,
    },
    artifact: { path: "artifact.zip", sizeBytes: 1 },
    ...(withWorkload ? { workload: workload() } : {}),
  };
}

function workload() {
  return {
    version: 1 as const,
    environmentId: "staging-1",
    manifestId: "manifest-1",
    manifestDigest: `sha256:${"a".repeat(64)}`,
    services: [
      {
        serviceId: "api",
        applicationId: "app-1",
        componentKey: "api",
        name: "api",
        kind: "container",
        artifactDigest: `sha256:${"b".repeat(64)}`,
        workingDirectory: ".",
        executionMode: "managed-command-v1" as const,
        startCommand: "true",
        statusCommand: "true",
        failureCleanupCommand: "true",
        startTimeoutMs: 5_000,
        statusTimeoutMs: 1_000,
        stateHash: "state",
      },
    ],
    inputHash: "input",
  };
}
