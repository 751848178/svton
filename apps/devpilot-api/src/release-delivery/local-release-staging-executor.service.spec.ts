import { ConfigService } from "@nestjs/config";
import { appendFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalReleaseStagingExecutorService } from "./local-release-staging-executor.service";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";

describe("LocalReleaseStagingExecutorService", () => {
  let scope: string;
  let checkout: string;
  let artifacts: ReleaseBuildArtifactService;
  let executor: LocalReleaseStagingExecutorService;

  beforeEach(async () => {
    scope = await mkdtemp(join(tmpdir(), "release-staging-spec-"));
    checkout = join(scope, "checkout");
    await mkdir(checkout);
    await writeFile(join(checkout, "app.txt"), "immutable artifact");
    const config = {
      get: jest.fn((key: string) => ({
        RELEASE_BUILD_ARTIFACT_ROOT: join(scope, "artifacts"),
        RELEASE_STAGING_DEPLOYMENT_ENABLED: true,
        RELEASE_STAGING_DEPLOYMENT_ROOT: join(scope, "deployments"),
        RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: 5_000,
      }[key])),
    } as unknown as ConfigService;
    artifacts = new ReleaseBuildArtifactService(config);
    executor = new LocalReleaseStagingExecutorService(config, artifacts);
  });

  afterEach(async () => rm(scope, { recursive: true, force: true }));

  it("verifies and materializes the same immutable artifact for independent runs", async () => {
    const artifact = await artifacts.package({
      checkoutRoot: checkout,
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "build-1",
    });
    const first = await executor.deploy(input("deployment-1", artifact));
    const second = await executor.deploy(input("deployment-2", artifact));
    expect(first.evidence).toMatchObject({ buildInvoked: false, gitInvoked: false });
    expect(second.deploymentUri).toBe("release-deployment://deployment-2");
    await expect(readFile(join(
      scope,
      "deployments/project-1/staging-1/deployment-1/app.txt",
    ), "utf8")).resolves.toBe("immutable artifact");
  });

  it("fails closed when stored artifact bytes no longer match the Manifest", async () => {
    const artifact = await artifacts.package({
      checkoutRoot: checkout,
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "build-1",
    });
    const stored = join(scope, "artifacts/project-1/order-1/build-1.zip");
    await appendFile(stored, "tampered");
    await expect(executor.deploy(input("deployment-1", artifact))).rejects.toThrow(
      "Digest 校验失败",
    );
  });
});

function input(deploymentRunId: string, artifact: { uri: string; digest: string }) {
  return {
    deploymentRunId,
    projectId: "project-1",
    releaseOrderId: "order-1",
    environmentId: "staging-1",
    buildRunId: "build-1",
    uri: artifact.uri,
    digest: artifact.digest,
  };
}
