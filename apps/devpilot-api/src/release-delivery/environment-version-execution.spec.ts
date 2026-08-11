import { ConflictException } from "@nestjs/common";
import { executeEnvironmentVersion } from "./environment-version-execution";

describe("executeEnvironmentVersion staging admission", () => {
  const repository = {
    environment: jest.fn(),
    manifest: jest.fn(),
    reserve: jest.fn(),
    replay: jest.fn(),
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
    routeSwitch: {
      supportsCompensation: true,
      verifyProductionCapability: jest.fn().mockResolvedValue(undefined),
    },
    routeSagaGuard: { assertClear: jest.fn().mockResolvedValue(undefined) },
    run,
  };
  const input = {
    teamId: "team-1",
    actorId: "user-1",
    projectId: "project-1",
    environmentId: "staging-1",
    kind: "upgrade" as const,
    manifestId: "manifest-1",
    idempotencyKey: "action-key-1",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.environment.mockResolvedValue({
      id: "staging-1",
      baselineRole: "staging",
      currentEnvironmentVersionId: null,
      currentConfigRevisionId: "config-1",
    });
    repository.replay.mockResolvedValue(null);
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

    expect(productionGates.admit).not.toHaveBeenCalled();
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
        inputHash: "deployment-input-hash",
        target: { bindingId: "binding-1", targetRef: "bound-target" },
        configRevision: { id: "config-1" },
        resourceReferences: [{ id: "resource-1" }],
        secretReferences: [{ id: "secret-1" }],
        routeTargets: [{ serviceId: "service-api", component: "api", port: 3000 }],
      },
      globalEnvironment: { NODE_ENV: "staging" },
      componentEnvironments: { api: { DATABASE_URL: "secret" } },
    };
    const workload = {
      environmentId: "staging-1",
      inputHash: "workload-hash",
      services: [{
        serviceId: "service-api",
        componentKey: "api",
        name: "api",
        ports: [3000],
      }],
    };
    inputs.prepare.mockResolvedValue(deploymentInput);
    stagingWorkloads.prepare.mockResolvedValue(workload);
    repository.reserve.mockResolvedValue({ id: "deployment-1" });
    run.mockResolvedValue({ id: "deployment-1" });

    await executeEnvironmentVersion(deps as never, input);

    expect(productionGates.admit).toHaveBeenCalledWith(
      expect.objectContaining({
        providerKey: "ssh-v1",
        bindingId: "binding-1",
        deploymentInputHash: "deployment-input-hash",
        idempotencyKey: "action-key-1",
      }),
      "staging",
    );

    expect(repository.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "action-key-1",
        inputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        params: expect.objectContaining({
          deploymentProvider: { key: "ssh-v1", targetRef: "bound-target" },
          deploymentInput: deploymentInput.snapshot,
          workload,
        }),
      }),
    );
    expect(productionWorkloads.prepare).not.toHaveBeenCalled();
  });

  it.each(["upgrade", "recovery"] as const)(
    "replays a completed Production %s after mutable environment state changed",
    async (kind) => {
      repository.environment.mockResolvedValue({
        id: "production-1",
        baselineRole: "production",
        currentEnvironmentVersionId: "version-newer",
        currentConfigRevisionId: "config-changed-after-success",
      });
      const environmentVersion = { id: "version-original" };
      repository.replay.mockResolvedValue({
        id: "deployment-original",
        status: "completed",
        environmentVersion,
        idempotentReplay: true,
      });
      const replayInput = {
        ...input,
        environmentId: "production-1",
        kind,
        manifestId: kind === "upgrade" ? "manifest-1" : undefined,
        sourceVersionId: kind === "recovery" ? "version-old" : undefined,
        releaseRunId: "release-approved-original",
      };

      await expect(
        executeEnvironmentVersion(deps as never, replayInput),
      ).resolves.toMatchObject({
        run: { id: "deployment-original", idempotentReplay: true },
        version: environmentVersion,
      });
      expect(policy.resolveSelection).not.toHaveBeenCalled();
      expect(policy.validateProduction).not.toHaveBeenCalled();
      expect(inputs.prepare).not.toHaveBeenCalled();
      expect(productionGates.admit).not.toHaveBeenCalled();
    },
  );

  it("fails Production admission before freezing or reserving without compensation capability", async () => {
    repository.environment.mockResolvedValue({
      id: "production-1",
      baselineRole: "production",
      currentEnvironmentVersionId: null,
      currentConfigRevisionId: "config-1",
    });
    repository.replay.mockResolvedValue(null);

    await expect(
      executeEnvironmentVersion(
        {
          ...deps,
          routeSwitch: {
            supportsCompensation: false,
            verifyProductionCapability: jest
              .fn()
              .mockRejectedValue(
                new Error("SITE_ROUTE_SWITCH_COMPENSATION_UNAVAILABLE"),
              ),
          },
        } as never,
        { ...input, environmentId: "production-1" },
      ),
    ).rejects.toThrow("SITE_ROUTE_SWITCH_COMPENSATION_UNAVAILABLE");

    expect(policy.resolveSelection).not.toHaveBeenCalled();
    expect(inputs.prepare).not.toHaveBeenCalled();
    expect(repository.reserve).not.toHaveBeenCalled();
  });

  it("rejects a new Production action while compensation is required", async () => {
    repository.environment.mockResolvedValue({
      id: "production-1",
      baselineRole: "production",
      currentEnvironmentVersionId: null,
      currentConfigRevisionId: "config-1",
    });
    repository.replay.mockResolvedValue(null);
    deps.routeSagaGuard.assertClear.mockRejectedValue(
      new ConflictException(
        "Production 路由切换 compensation_required 尚未收敛",
      ),
    );

    await expect(
      executeEnvironmentVersion(deps as never, {
        ...input,
        environmentId: "production-1",
      }),
    ).rejects.toThrow("compensation_required");

    expect(deps.routeSwitch.verifyProductionCapability).not.toHaveBeenCalled();
    expect(repository.reserve).not.toHaveBeenCalled();
  });
});
