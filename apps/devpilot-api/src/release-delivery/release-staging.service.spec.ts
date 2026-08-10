import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ReleaseStagingExecutionError } from "./release-staging.types";
import { ReleaseStagingService } from "./release-staging.service";
import {
  deploymentInputSnapshot,
  releaseStagingContext as context,
  releaseStagingInput as input,
  releaseStagingManifest as manifest,
  stagingWorkloadSnapshot,
} from "./release-staging.service.spec-fixture";

describe("ReleaseStagingService", () => {
  const repository = {
    context: jest.fn(),
    manifest: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    finish: jest.fn(),
  };
  const executor = {
    providerKey: "provider-test-v1",
    providerTargetRef: "provider-test-target",
    deploy: jest.fn(),
  };
  const gates = { assertAllowed: jest.fn() };
  const inputs = { prepare: jest.fn() };
  const workloads = { prepare: jest.fn() };
  const service = new ReleaseStagingService(
    repository as never,
    executor as never,
    gates as never,
    inputs as never,
    workloads as never,
  );
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
    inputs.prepare.mockResolvedValue({
      snapshot: deploymentInputSnapshot(),
      runtimeEnvironment: {},
    });
    workloads.prepare.mockResolvedValue(stagingWorkloadSnapshot());
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
        providerKey: "provider-test-v1",
        params: expect.objectContaining({
          deploymentProvider: {
            key: "provider-test-v1",
            targetRef: "provider-test-target",
          },
          workload: stagingWorkloadSnapshot(),
        }),
        sourceCommitSha: "b".repeat(40),
        gateDecision: {
          id: "decision-staging-1",
          stage: "staging",
          inputHash: "decision-hash",
        },
      }),
    );
    expect(executor.deploy).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "staging",
        manifestId: "manifest-1",
        digest: manifest.digest,
        workload: stagingWorkloadSnapshot(),
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
    expect(inputs.prepare).not.toHaveBeenCalled();
    expect(workloads.prepare).not.toHaveBeenCalled();
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

  it("rejects a Manifest whose related BuildRun belongs to another scope", async () => {
    repository.manifest.mockResolvedValue({
      ...manifest,
      buildRun: { ...manifest.buildRun, releaseOrderId: "order-foreign" },
    });
    await expect(service.deploy(input())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(gates.assertAllowed).not.toHaveBeenCalled();
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

  it("does not call the provider when the repository detects input drift", async () => {
    repository.create.mockRejectedValue(
      new UnprocessableEntityException("deployment input drift"),
    );
    await expect(service.deploy(input())).rejects.toThrow("input drift");
    expect(executor.deploy).not.toHaveBeenCalled();
  });

  it("does not defer unavailable Provider gates at admission", async () => {
    await service.deploy(input());
    expect(gates.assertAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "staging",
      }),
    );
    expect(gates.assertAllowed.mock.calls[0][0]).not.toHaveProperty(
      "deferredReasons",
    );
    expect(repository.create).toHaveBeenCalledTimes(1);
  });
});
