import { ConfigService } from "@nestjs/config";
import { appendFile, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { LocalReleaseStagingExecutorService } from "./local-release-staging-executor.service";

describe("LocalReleaseStagingExecutorService", () => {
  let scope: string;
  let artifacts: ReleaseBuildArtifactService;
  const provider = {
    key: "provider-test-v1",
    targetRef: "provider-test-target",
    deployExactManifest: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    scope = await mkdtemp(join(tmpdir(), "release-staging-executor-spec-"));
    const checkout = join(scope, "checkout");
    await mkdir(join(checkout, "dist"), { recursive: true });
    await writeFile(join(checkout, "dist", "app.txt"), "immutable artifact");
    artifacts = new ReleaseBuildArtifactService(config(scope));
    provider.deployExactManifest.mockImplementation(async (input) => ({
      providerKey: provider.key,
      providerDeploymentId: input.deploymentRunId,
      targetRef: provider.targetRef,
      deploymentUri: `provider-test://${input.deploymentRunId}`,
      manifestId: input.manifest.id,
      manifestDigest: input.manifest.digest,
      activatedAt: "2026-08-06T00:00:00.000Z",
      logs: ["activated"],
      evidence: { providerActivated: true },
    }));
    const artifact = await artifacts.package({
      checkoutRoot: checkout,
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "build-1",
      components: [component()],
    });
    thisArtifact = artifact;
  });

  afterEach(async () => rm(scope, { recursive: true, force: true }));

  let thisArtifact: { uri: string; digest: string };

  it("verifies the exact Manifest bytes before invoking the provider", async () => {
    const executor = new LocalReleaseStagingExecutorService(
      artifacts,
      provider,
    );
    const result = await executor.deploy(input("deployment-1", thisArtifact));
    expect(provider.deployExactManifest).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentRunId: "deployment-1",
        stage: "staging",
        manifest: expect.objectContaining({
          id: "manifest-1",
          digest: thisArtifact.digest,
        }),
        artifact: expect.objectContaining({ path: expect.any(String) }),
      }),
    );
    expect(result.evidence).toMatchObject({
      providerKey: provider.key,
      artifactVerified: true,
      providerActivated: true,
    });
  });

  it("does not invoke the provider when stored bytes fail Digest verification", async () => {
    const stored = join(
      scope,
      "artifacts/project-1/order-1/build-1/bundle.zip",
    );
    await appendFile(stored, "tampered");
    const executor = new LocalReleaseStagingExecutorService(
      artifacts,
      provider,
    );
    await expect(
      executor.deploy(input("deployment-1", thisArtifact)),
    ).rejects.toThrow("Digest 校验失败");
    expect(provider.deployExactManifest).not.toHaveBeenCalled();
  });
});

function config(scope: string) {
  return {
    get: jest.fn((key: string) =>
      key === "RELEASE_BUILD_ARTIFACT_ROOT"
        ? join(scope, "artifacts")
        : undefined,
    ),
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
  artifact: { uri: string; digest: string },
) {
  return {
    deploymentRunId,
    stage: "staging" as const,
    projectId: "project-1",
    releaseOrderId: "order-1",
    environmentId: "staging-1",
    manifestId: "manifest-1",
    buildRunId: "build-1",
    uri: artifact.uri,
    digest: artifact.digest,
  };
}
