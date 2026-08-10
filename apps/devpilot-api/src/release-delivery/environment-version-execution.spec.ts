import { ConflictException } from "@nestjs/common";
import { executeEnvironmentVersion } from "./environment-version-execution";

describe("executeEnvironmentVersion staging admission", () => {
  const repository = {
    environment: jest.fn(),
    manifest: jest.fn(),
    reserve: jest.fn(),
  };
  const policy = {
    resolveSelection: jest.fn(),
    validateProduction: jest.fn(),
  };
  const productionGates = { admit: jest.fn() };
  const inputs = { prepare: jest.fn() };
  const stagingWorkloads = { prepare: jest.fn() };
  const productionWorkloads = { prepare: jest.fn() };
  const run = jest.fn();
  const deps = {
    repository,
    policy,
    executor: { providerKey: "ssh-v1", providerTargetRef: "global-target" },
    productionGates,
    inputs,
    stagingWorkloads,
    productionWorkloads,
    run,
  };
  const input = {
    teamId: "team-1",
    actorId: "user-1",
    projectId: "project-1",
    environmentId: "staging-1",
    kind: "upgrade" as const,
    manifestId: "manifest-1",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.environment.mockResolvedValue({
      id: "staging-1",
      baselineRole: "staging",
      currentEnvironmentVersionId: null,
      currentConfigRevisionId: "config-1",
    });
    policy.resolveSelection.mockResolvedValue({
      manifestId: "manifest-1",
      sourceVersionId: undefined,
    });
    repository.manifest.mockResolvedValue({
      id: "manifest-1",
      digest: "sha256:artifact",
      releaseOrderId: "order-1",
      items: [
        {
          componentKey: "project-bundle",
          digest: "sha256:artifact",
          uri: "artifact://bundle",
        },
      ],
      buildRun: {
        id: "build-1",
        status: "succeeded",
        sourceBranch: "main",
        sourceCommitSha: "a".repeat(40),
      },
    });
    policy.validateProduction.mockResolvedValue(undefined);
    productionGates.admit.mockResolvedValue({
      id: "gate-1",
      stage: "staging",
      inputHash: "gate-hash",
    });
  });

  it("fails before reserving a run when no Provider-matched target is bound", async () => {
    inputs.prepare.mockRejectedValue(
      new ConflictException("部署目标绑定缺失、重复或与 Provider 不匹配"),
    );

    await expect(
      executeEnvironmentVersion(deps as never, input),
    ).rejects.toThrow("部署目标绑定缺失");

    expect(productionGates.admit).toHaveBeenCalledWith(
      expect.objectContaining({ environmentId: "staging-1" }),
      "staging",
    );
    expect(inputs.prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentId: "staging-1",
        providerKey: "ssh-v1",
        configRevisionId: "config-1",
      }),
    );
    expect(stagingWorkloads.prepare).not.toHaveBeenCalled();
    expect(repository.reserve).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("freezes target, config and staging workload before reserving", async () => {
    const deploymentInput = {
      snapshot: {
        target: { targetRef: "bound-target" },
        configRevision: { id: "config-1" },
        resourceReferences: [{ id: "resource-1" }],
        secretReferences: [{ id: "secret-1" }],
      },
      runtimeEnvironment: { DATABASE_URL: "secret" },
    };
    const workload = { environmentId: "staging-1", services: [] };
    inputs.prepare.mockResolvedValue(deploymentInput);
    stagingWorkloads.prepare.mockResolvedValue(workload);
    repository.reserve.mockResolvedValue({ id: "deployment-1" });
    run.mockResolvedValue({ id: "deployment-1" });

    await executeEnvironmentVersion(deps as never, input);

    expect(repository.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          deploymentProvider: { key: "ssh-v1", targetRef: "bound-target" },
          deploymentInput: deploymentInput.snapshot,
          workload,
        }),
      }),
    );
    expect(productionWorkloads.prepare).not.toHaveBeenCalled();
  });
});
