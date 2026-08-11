import { ConfigService } from "@nestjs/config";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { UnzipReleaseArtifactArchiveService } from "./release-artifact-archive.service";
import { LocalFilesystemDeploymentProviderService } from "./local-filesystem-deployment-provider.service";

describe("LocalFilesystemDeploymentProviderService", () => {
  let scope: string;
  let checkout: string;
  let artifacts: ReleaseBuildArtifactService;

  beforeEach(async () => {
    scope = await mkdtemp(join(tmpdir(), "release-provider-spec-"));
    checkout = join(scope, "checkout");
    await mkdir(join(checkout, "dist"), { recursive: true });
    await writeFile(join(checkout, "dist", "app.txt"), "provider target");
    artifacts = new ReleaseBuildArtifactService(config(scope, true));
  });

  afterEach(async () => rm(scope, { recursive: true, force: true }));

  it("creates independent releases and atomically activates the latest exact Manifest", async () => {
    const published = await artifacts.package({
      checkoutRoot: checkout,
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "build-1",
      components: [component()],
    });
    const artifact = await artifacts.resolveAndVerify({
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "build-1",
      uri: published.uri,
      digest: published.digest,
    });
    const provider = new LocalFilesystemDeploymentProviderService(
      config(scope, true),
      new UnzipReleaseArtifactArchiveService(),
    );
    const first = await provider.deployExactManifest(
      input("deployment-1", published, artifact),
    );
    const second = await provider.deployExactManifest(
      input("deployment-2", published, artifact),
    );
    expect(first.providerDeploymentId).not.toBe(second.providerDeploymentId);
    expect(second).toMatchObject({
      providerKey: "local-filesystem-v1",
      manifestId: "manifest-1",
      manifestDigest: published.digest,
      evidence: {
        providerActivated: true,
        runtimeEnvironmentFileMode: "0600",
        buildInvoked: false,
        gitInvoked: false,
      },
    });
    for (const run of ["deployment-1", "deployment-2"]) {
      await expect(
        readFile(
          join(
            scope,
            "deployments/project-1/staging-1/releases",
            run,
            "dist/app.txt",
          ),
          "utf8",
        ),
      ).resolves.toBe("provider target");
    }
    const active = JSON.parse(
      await readFile(
        join(scope, "deployments/project-1/staging-1/active.json"),
        "utf8",
      ),
    );
    expect(active).toMatchObject({
      providerKey: "local-filesystem-v1",
      providerDeploymentId: "deployment-2",
      manifestId: "manifest-1",
      manifestDigest: published.digest,
    });
    expect(JSON.stringify(active)).not.toContain("secret-sentinel-f432");
    const runtimePath = join(
      scope,
      "deployments/project-1/staging-1/releases/deployment-2/.devpilot/env/service-1.env",
    );
    await expect(readFile(runtimePath, "utf8")).resolves.toBe(
      "API_TOKEN=secret-sentinel-f432\nDATABASE_URL=service-db\nNODE_ENV=staging\n",
    );
    expect((await stat(runtimePath)).mode & 0o777).toBe(0o600);
    expect(second.logs.join("\n")).not.toContain("secret-sentinel-f432");
    expect(second.evidence.globalEnvironmentKeys).toEqual([
      "API_TOKEN",
      "NODE_ENV",
    ]);
    expect(second.evidence.componentEnvironmentKeys).toEqual({
      "service-1": ["DATABASE_URL"],
    });
  });

  it("rejects an input frozen for a different target", async () => {
    const provider = new LocalFilesystemDeploymentProviderService(
      config(scope, false),
      new UnzipReleaseArtifactArchiveService(),
    );
    await expect(
      provider.deployExactManifest({
        ...input(
          "deployment-1",
          { uri: "artifact", digest: "sha256:x" },
          { path: "x", sizeBytes: 1 },
        ),
        targetRef: "foreign-target",
      }),
    ).rejects.toThrow("目标引用不匹配");
  });
});

function config(scope: string, enabled: boolean) {
  const values: Record<string, unknown> = {
    RELEASE_BUILD_ARTIFACT_ROOT: join(scope, "artifacts"),
    RELEASE_STAGING_DEPLOYMENT_ENABLED: enabled,
    RELEASE_DEPLOYMENT_PROVIDER_PROFILE: enabled
      ? "local-filesystem-v1"
      : "disabled",
    RELEASE_STAGING_DEPLOYMENT_ROOT: join(scope, "deployments"),
    RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: 5_000,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function component() {
  return {
    key: "service-1",
    name: "api",
    workingDirectory: ".",
    buildCommand: "true",
    artifactOutputs: ["dist"],
    buildEnvironment: {},
  };
}

function input(
  deploymentRunId: string,
  published: { uri: string; digest: string },
  artifact: { path: string; sizeBytes: number },
) {
  return {
    deploymentRunId,
    stage: "staging" as const,
    projectId: "project-1",
    releaseOrderId: "order-1",
    environmentId: "staging-1",
    targetRef: "filesystem-release-target",
    manifest: {
      id: "manifest-1",
      buildRunId: "build-1",
      uri: published.uri,
      digest: published.digest,
    },
    artifact,
    globalEnvironment: {
      API_TOKEN: "secret-sentinel-f432",
      NODE_ENV: "staging",
    },
    componentEnvironments: { "service-1": { DATABASE_URL: "service-db" } },
  };
}
