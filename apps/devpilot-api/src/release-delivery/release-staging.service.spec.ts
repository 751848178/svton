import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ReleaseStagingExecutionError } from "./release-staging.types";
import { ReleaseStagingService } from "./release-staging.service";

describe("ReleaseStagingService", () => {
  const repository = {
    context: jest.fn(),
    manifest: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    finish: jest.fn(),
  };
  const executor = { deploy: jest.fn() };
  const gates = { assertAllowed: jest.fn() };
  const service = new ReleaseStagingService(
    repository as never,
    executor as never,
    gates as never,
  );
  const context = {
    id: "order-1",
    project: { environments: [{ id: "staging-1", name: "Staging" }] },
  };
  const manifest = {
    id: "manifest-1",
    digest: `sha256:${"a".repeat(64)}`,
    buildRun: {
      id: "build-1",
      status: "succeeded",
      sourceBranch: "main",
      sourceCommitSha: "b".repeat(40),
    },
    items: [
      {
        componentKey: "project-bundle",
        uri: "release-artifact://build-1/bundle.zip",
        digest: `sha256:${"a".repeat(64)}`,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.context.mockResolvedValue(context);
    repository.manifest.mockResolvedValue(manifest);
    repository.create.mockResolvedValue({ id: "deployment-1" });
    executor.deploy.mockResolvedValue({
      deploymentUri: "release-deployment://deployment-1",
      logs: ["ok"],
      evidence: { buildInvoked: false, gitInvoked: false },
    });
    gates.assertAllowed.mockResolvedValue({
      id: "decision-staging-1",
      stage: "staging",
      inputHash: "decision-hash",
    });
    repository.finish.mockImplementation(async (input) => ({
      id: input.deploymentRunId,
      status: input.status,
      artifactManifestId: "manifest-1",
    }));
  });

  it("creates a fresh DeploymentRun for each exact-Manifest request", async () => {
    await service.deploy(input());
    repository.create.mockResolvedValue({ id: "deployment-2" });
    await service.deploy(input());
    expect(repository.create).toHaveBeenCalledTimes(2);
    expect(executor.deploy).toHaveBeenCalledTimes(2);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        manifestId: "manifest-1",
        sourceCommitSha: "b".repeat(40),
        gateDecision: {
          id: "decision-staging-1",
          stage: "staging",
          inputHash: "decision-hash",
        },
      }),
    );
    expect(repository.finish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        deploymentRunId: "deployment-2",
        status: "completed",
        result: expect.objectContaining({
          buildInvoked: false,
          gitInvoked: false,
        }),
      }),
    );
  });

  it("denies before creating a DeploymentRun or calling the executor", async () => {
    gates.assertAllowed.mockRejectedValue(
      new UnprocessableEntityException("blocked"),
    );
    await expect(service.deploy(input())).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(repository.create).not.toHaveBeenCalled();
    expect(executor.deploy).not.toHaveBeenCalled();
  });

  it("rejects cross-order or unknown Manifests before creating a run", async () => {
    repository.manifest.mockResolvedValue(null);
    await expect(service.deploy(input())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects a Manifest whose BuildRun is not successful", async () => {
    repository.manifest.mockResolvedValue({
      ...manifest,
      buildRun: { ...manifest.buildRun, status: "failed" },
    });
    await expect(service.deploy(input())).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("retains a failed DeploymentRun when exact artifact execution fails", async () => {
    executor.deploy.mockRejectedValue(
      new ReleaseStagingExecutionError({
        code: "ARTIFACT_DIGEST_MISMATCH",
        message: "digest mismatch",
        logs: ["failed"],
      }),
    );
    await expect(service.deploy(input())).resolves.toMatchObject({
      status: "failed",
    });
    expect(repository.finish).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error: "ARTIFACT_DIGEST_MISMATCH: digest mismatch",
      }),
    );
  });

  function input() {
    return {
      teamId: "team-1",
      actorId: "user-1",
      projectId: "project-1",
      releaseOrderId: "order-1",
      manifestId: "manifest-1",
    };
  }
});
