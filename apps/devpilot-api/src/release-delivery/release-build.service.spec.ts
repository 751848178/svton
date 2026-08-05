import { UnprocessableEntityException } from "@nestjs/common";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";
import { ReleaseBuildService } from "./release-build.service";

describe("ReleaseBuildService", () => {
  const connection = {
    id: "connection-1",
    teamId: "team-1",
    repositoryUrl: "https://user:secret@example.com/repo.git",
    defaultBranch: "main",
    status: "connected",
  };
  const context = {
    id: "order-1",
    project: {
      repositoryConnection: connection,
      applications: [
        {
          id: "application-1",
          name: "api",
          repoPath: ".",
          services: [
            {
              id: "service-1",
              name: "api",
              deployConfig: {
                workingDirectory: ".",
                buildCommand: "npm run build",
              },
            },
          ],
        },
      ],
    },
  };
  const repository = {
    context: jest.fn(),
    list: jest.fn(),
    reserve: jest.fn(),
  };
  const results = { succeed: jest.fn(), fail: jest.fn() };
  const cleanup = jest.fn();
  const git = { checkout: jest.fn() };
  const sources = { resolve: jest.fn() };
  const executor = { execute: jest.fn() };
  const gates = { assertAllowed: jest.fn() };
  const service = new ReleaseBuildService(
    repository as never,
    results as never,
    git as never,
    sources as never,
    executor as never,
    gates as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.context.mockResolvedValue(context);
    sources.resolve.mockResolvedValue({
      context,
      connection,
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
    });
    git.checkout.mockResolvedValue({ root: "/tmp/build", cleanup });
    repository.reserve.mockResolvedValue(record(1, "running"));
    executor.execute.mockResolvedValue({
      artifact: {
        digest: `sha256:${"c".repeat(64)}`,
        sizeBytes: 42,
        uri: "release-artifact://run-1/bundle.zip",
      },
      logs: ["build ok"],
      gateSummary: { build: { status: "passed" } },
    });
    gates.assertAllowed.mockResolvedValue({
      id: "decision-build-1",
      stage: "build",
      inputHash: "decision-hash",
    });
    results.succeed.mockResolvedValue(
      record(1, "succeeded", { id: "manifest-1" }),
    );
    results.fail.mockResolvedValue(record(1, "failed"));
  });

  it("resolves the server-side default branch and freezes its latest commit", async () => {
    await service.build("team-1", "user-1", "project-1", "order-1");
    expect(sources.resolve).toHaveBeenCalledWith(
      "team-1",
      "project-1",
      "order-1",
    );
    expect(repository.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          repositoryUrl: "https://[REDACTED]@example.com/repo.git",
          sourceBranch: "main",
          sourceCommitSha: "b".repeat(40),
        }),
      }),
    );
    expect(git.checkout).toHaveBeenCalledWith(
      connection.repositoryUrl,
      "main",
      "b".repeat(40),
      expect.anything(),
    );
    expect(cleanup).toHaveBeenCalled();
  });

  it("creates an independent reserved run for every build request", async () => {
    await service.build("team-1", "user-1", "project-1", "order-1");
    repository.reserve.mockResolvedValue(record(2, "running"));
    results.succeed.mockResolvedValue(
      record(2, "succeeded", { id: "manifest-2" }),
    );
    await service.build("team-1", "user-1", "project-1", "order-1");
    expect(repository.reserve).toHaveBeenCalledTimes(2);
    expect(results.succeed).toHaveBeenCalledTimes(2);
  });

  it("records a failed BuildRun without creating a Manifest", async () => {
    executor.execute.mockRejectedValue(
      new ReleaseBuildExecutionError({
        code: "BUILD_COMMAND_FAILED",
        message: "build failed",
        logs: ["token=secret"],
        gateSummary: { build: { status: "failed" } },
      }),
    );
    await expect(
      service.build("team-1", "user-1", "project-1", "order-1"),
    ).resolves.toEqual(
      expect.objectContaining({ status: "failed", manifest: null }),
    );
    expect(results.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "BUILD_COMMAND_FAILED",
      }),
    );
    expect(results.succeed).not.toHaveBeenCalled();
  });

  it("fails closed before execution when the main repository is not connected", async () => {
    sources.resolve.mockRejectedValue(
      new UnprocessableEntityException("not ready"),
    );
    await expect(
      service.build("team-1", "user-1", "project-1", "order-1"),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repository.reserve).not.toHaveBeenCalled();
  });

  it("persists the server gate reference before reserving or executing", async () => {
    await service.build("team-1", "user-1", "project-1", "order-1");
    expect(gates.assertAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "build",
        target: {
          sourceBranch: "main",
          sourceCommitSha: "b".repeat(40),
        },
      }),
    );
    expect(repository.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          gateDecision: {
            id: "decision-build-1",
            stage: "build",
            inputHash: "decision-hash",
          },
        }),
      }),
    );
  });
});

function record(revision: number, status: string, manifest: unknown = null) {
  return {
    id: `run-${revision}`,
    releaseOrderId: "order-1",
    revision,
    sourceBranch: "main",
    sourceCommitSha: "b".repeat(40),
    status,
    inputHash: "hash",
    logReference: null,
    logSummary: null,
    gateSummary: null,
    errorCode: status === "failed" ? "BUILD_COMMAND_FAILED" : null,
    errorMessage: status === "failed" ? "build failed" : null,
    startedAt: new Date(),
    finishedAt: status === "running" ? null : new Date(),
    createdAt: new Date(),
    manifest,
    repositoryIdentity: {
      provider: "generic",
      canonicalUrl: "https://example.com/repo",
    },
    repositoryIdentityRevision: {
      id: "revision-1",
      revision: 1,
      defaultBranch: "main",
    },
  };
}
