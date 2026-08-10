import { ConflictException } from "@nestjs/common";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";
import { ReleaseBuildRunnerService } from "./release-build-runner.service";
import { ReleaseBuildRunTimeoutError } from "./release-build-runtime-supervisor.service";

describe("ReleaseBuildRunnerService", () => {
  const results = {
    succeed: jest.fn(),
    fail: jest.fn(),
    hasCommittedArtifact: jest.fn(),
  };
  const cleanup = jest.fn();
  const git = { checkout: jest.fn() };
  const executor = { execute: jest.fn(), discardArtifact: jest.fn() };
  const runtime = { workRoot: "/tmp/f426-work" };
  const runner = new ReleaseBuildRunnerService(
    results as never,
    git as never,
    executor as never,
    runtime as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    git.checkout.mockResolvedValue({
      root: "/tmp/f426-work/checkout",
      cleanup,
    });
    executor.execute.mockResolvedValue({
      artifact: {
        digest: `sha256:${"a".repeat(64)}`,
        uri: "artifact://1",
        sizeBytes: 1,
        items: [],
        contentIndex: [],
      },
      logs: ["ok"],
      gateSummary: { build: { status: "passed" } },
    });
    results.succeed.mockResolvedValue(record("succeeded"));
    results.fail.mockResolvedValue(record("failed"));
    results.hasCommittedArtifact.mockResolvedValue(false);
    executor.discardArtifact.mockResolvedValue(undefined);
  });

  it("passes the controlled workspace and AbortSignal through checkout and command", async () => {
    const controller = new AbortController();
    await runner.run(input(controller.signal));
    expect(git.checkout).toHaveBeenCalledWith(
      "https://example.com/repo.git",
      "main",
      "b".repeat(40),
      expect.anything(),
      controller.signal,
      { root: "/tmp/f426-work", prefix: "devpilot-release-build-" },
    );
    expect(executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({ buildRunId: "run-1" }),
      controller.signal,
    );
    expect(results.succeed).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("persists a distinct canceled terminal result", async () => {
    executor.execute.mockRejectedValue(
      new ReleaseBuildExecutionError({
        code: "BUILD_COMMAND_CANCELED",
        message: "canceled",
        logs: [],
        status: "canceled",
        gateSummary: { build: { status: "failed" } },
      }),
    );
    results.fail.mockResolvedValue(record("canceled"));
    await expect(
      runner.run(input(new AbortController().signal)),
    ).resolves.toMatchObject({
      status: "canceled",
    });
    expect(results.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "BUILD_COMMAND_CANCELED",
        status: "canceled",
      }),
    );
    expect(results.succeed).not.toHaveBeenCalled();
  });

  it("does not let cleanup failure replace the recorded outcome", async () => {
    cleanup.mockRejectedValueOnce(new Error("cleanup failed"));
    await expect(
      runner.run(input(new AbortController().signal)),
    ).resolves.toMatchObject({
      status: "succeeded",
    });
  });

  it("discards a packaged artifact when Manifest persistence loses the terminal race", async () => {
    results.succeed.mockRejectedValueOnce(
      new ConflictException("terminal conflict"),
    );
    await expect(
      runner.run(input(new AbortController().signal)),
    ).resolves.toMatchObject({ status: "failed" });
    expect(executor.discardArtifact).toHaveBeenCalledWith({
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "run-1",
    });
    expect(results.fail).toHaveBeenCalledTimes(1);
  });

  it("retains bytes when a persistence error leaves commit state uncertain", async () => {
    results.succeed.mockRejectedValueOnce(new Error("connection lost"));
    results.hasCommittedArtifact.mockRejectedValueOnce(
      new Error("commit state unavailable"),
    );
    await expect(
      runner.run(input(new AbortController().signal)),
    ).resolves.toMatchObject({ status: "failed" });
    expect(executor.discardArtifact).not.toHaveBeenCalled();
  });

  it("persists the supervisor deadline before non-cooperative work settles", async () => {
    const controller = new AbortController();
    controller.abort(new ReleaseBuildRunTimeoutError());
    await runner.abort("run-1", controller.signal);
    expect(results.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        buildRunId: "run-1",
        code: "BUILD_RUN_TIMEOUT",
        status: "failed",
      }),
    );
  });
});

function input(signal: AbortSignal) {
  return {
    buildRun: {
      id: "run-1",
      sourceBranch: "main",
      sourceCommitSha: "b".repeat(40),
      inputHash: "input-hash",
    },
    teamId: "team-1",
    projectId: "project-1",
    releaseOrderId: "order-1",
    source: {
      connection: { repositoryUrl: "https://example.com/repo.git" },
      identity: {
        id: "identity-1",
        revisionId: "revision-1",
        revision: 1,
        provider: "generic",
        canonicalKey: "example.com/repo",
        canonicalUrl: "https://example.com/repo",
        branch: "main",
      },
      credential: { kind: "none" },
      commitSha: "b".repeat(40),
    },
    components: [
      {
        key: "app",
        name: "app",
        workingDirectory: ".",
        buildCommand: "true",
        artifactOutputs: ["dist"],
        buildEnvironment: {},
      },
    ],
    signal,
  } as never;
}

function record(status: string) {
  return {
    id: "run-1",
    releaseOrderId: "order-1",
    revision: 1,
    sourceBranch: "main",
    sourceCommitSha: "b".repeat(40),
    status,
    inputHash: "input-hash",
    logReference: null,
    logSummary: null,
    gateSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: new Date(),
    finishedAt: new Date(),
    createdAt: new Date(),
    manifest: null,
    inputSnapshot: null,
    repositoryIdentity: null,
    repositoryIdentityRevision: null,
  };
}
