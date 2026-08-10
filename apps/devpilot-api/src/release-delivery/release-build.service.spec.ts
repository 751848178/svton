import { UnprocessableEntityException } from "@nestjs/common";
import { ReleaseBuildService } from "./release-build.service";

describe("ReleaseBuildService", () => {
  const signal = new AbortController().signal;
  const repository = {
    context: jest.fn(),
    list: jest.fn(),
    reserve: jest.fn(),
  };
  const sources = { resolve: jest.fn() };
  const gates = { assertAllowed: jest.fn() };
  const runner = { run: jest.fn(), abort: jest.fn() };
  const runtime = {
    assertAvailable: jest.fn(),
    descriptor: jest.fn(() => descriptor()),
  };
  const bind = jest.fn();
  const supervisor = {
    run: jest.fn((task) => task({ signal, bind })),
  };
  const service = new ReleaseBuildService(
    repository as never,
    sources as never,
    gates as never,
    runner as never,
    runtime as never,
    supervisor as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    sources.resolve.mockResolvedValue(source());
    gates.assertAllowed.mockResolvedValue({
      id: "decision-1",
      stage: "build",
      inputHash: "decision-hash",
    });
    repository.reserve.mockResolvedValue({
      id: "run-1",
      sourceBranch: "main",
      sourceCommitSha: "b".repeat(40),
      inputHash: "snapshot-hash",
    });
    runner.run.mockResolvedValue({ id: "run-1", status: "succeeded" });
    runner.abort.mockResolvedValue(undefined);
  });

  it("fails closed before source resolution when the runtime is disabled", async () => {
    runtime.assertAvailable.mockImplementationOnce(() => {
      throw new UnprocessableEntityException("disabled");
    });
    await expect(
      service.build("team-1", "user-1", "project-1", "order-1"),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(sources.resolve).not.toHaveBeenCalled();
    expect(repository.reserve).not.toHaveBeenCalled();
  });

  it("freezes source, runtime, declared outputs and public build values in snapshot v4", async () => {
    await service.build("team-1", "user-1", "project-1", "order-1");
    expect(sources.resolve).toHaveBeenCalledWith(
      "team-1",
      "project-1",
      "order-1",
      signal,
    );
    const reservation = repository.reserve.mock.calls[0][0];
    expect(reservation.snapshot).toMatchObject({
      version: 4,
      repositoryUrl: "https://[REDACTED]@example.com/repo.git",
      sourceBranch: "main",
      sourceCommitSha: "b".repeat(40),
      gateDecision: {
        id: "decision-1",
        stage: "build",
        inputHash: "decision-hash",
      },
      runtime: descriptor(),
      artifactContract: {
        version: 1,
        collection: "declared-outputs-only",
        environment: "explicit-public-build-values",
      },
      components: [
        expect.objectContaining({
          key: "service-1",
          artifactOutputs: ["dist"],
          buildEnvironment: { NEXT_PUBLIC_API_URL: "https://api.example" },
        }),
      ],
    });
    expect(reservation.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(bind).toHaveBeenCalledWith("run-1", expect.any(Function));
    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        signal,
        components: reservation.snapshot.components,
      }),
    );
    const persistAbort = bind.mock.calls[0][1];
    await persistAbort(signal);
    expect(runner.abort).toHaveBeenCalledWith("run-1", signal);
  });

  it("reserves one independent run for every accepted request", async () => {
    gates.assertAllowed
      .mockResolvedValueOnce({
        id: "decision-1",
        stage: "build",
        inputHash: "decision-hash",
      })
      .mockResolvedValueOnce({
        id: "decision-2",
        stage: "build",
        inputHash: "decision-hash",
      });
    await service.build("team-1", "user-1", "project-1", "order-1");
    await service.build("team-1", "user-1", "project-1", "order-1");
    expect(repository.reserve).toHaveBeenCalledTimes(2);
    expect(runner.run).toHaveBeenCalledTimes(2);
    const [first, second] = repository.reserve.mock.calls.map(
      ([input]) => input,
    );
    expect(first.snapshot.gateDecision.id).not.toBe(
      second.snapshot.gateDecision.id,
    );
    expect(first.inputHash).toBe(second.inputHash);
  });
});

function source() {
  return {
    context: {
      project: {
        applications: [
          {
            id: "app-1",
            name: "api",
            repoPath: ".",
            services: [
              {
                id: "service-1",
                name: "api",
                deployConfig: {
                  workingDirectory: ".",
                  buildCommand: "npm run build",
                  artifactPaths: ["dist"],
                  buildEnvironment: {
                    NEXT_PUBLIC_API_URL: "https://api.example",
                  },
                },
              },
            ],
          },
        ],
      },
    },
    connection: {
      repositoryUrl: "https://user:secret@example.com/repo.git",
    },
    credential: { kind: "none" },
    identity: {
      id: "identity-1",
      revisionId: "revision-1",
      revision: 1,
      provider: "generic",
      canonicalKey: "example.com/repo",
      canonicalUrl: "https://example.com/repo",
      branch: "main",
    },
    commitSha: "b".repeat(40),
  };
}

function descriptor() {
  return {
    profile: "controlled-local-v1",
    runTimeoutMs: 180_000,
    commandTimeoutMs: 120_000,
    cancelGraceMs: 5_000,
    maxConcurrency: 2,
    concurrencyScope: "single-process",
    workspacePolicy: "dedicated-build-root",
    environmentKeys: ["CI", "HOME", "LANG", "LC_ALL", "PATH", "TMPDIR"],
  };
}
