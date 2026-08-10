import { ConflictException } from "@nestjs/common";
import { ReleaseBuildCancellationService } from "./release-build-cancellation.service";

describe("ReleaseBuildCancellationService", () => {
  const builds = { get: jest.fn() };
  const results = { cancelActive: jest.fn() };
  const supervisor = { cancel: jest.fn() };
  const service = new ReleaseBuildCancellationService(
    builds as never,
    results as never,
    supervisor as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    builds.get.mockResolvedValue(record("running"));
    results.cancelActive.mockResolvedValue(record("canceled"));
  });

  it("signals the active runtime without racing a terminal database write", async () => {
    supervisor.cancel.mockResolvedValue(true);
    builds.get
      .mockResolvedValueOnce(record("running"))
      .mockResolvedValueOnce(record("canceled"));
    await expect(service.cancel(scope())).resolves.toMatchObject({
      id: "run-1",
      status: "canceled",
      revision: 1,
    });
    expect(results.cancelActive).not.toHaveBeenCalled();
  });

  it("recovers an orphaned running row when no local runtime owns it", async () => {
    supervisor.cancel.mockResolvedValue(false);
    await expect(service.cancel(scope())).resolves.toMatchObject({
      id: "run-1",
      status: "canceled",
    });
    expect(results.cancelActive).toHaveBeenCalledWith("run-1");
  });

  it("persists cancellation for an orphaned queued row", async () => {
    builds.get.mockResolvedValue(record("queued"));
    supervisor.cancel.mockResolvedValue(false);
    await expect(service.cancel(scope())).resolves.toMatchObject({
      status: "canceled",
    });
    expect(results.cancelActive).toHaveBeenCalledWith("run-1");
  });

  it("is idempotent for canceled runs and rejects other terminal states", async () => {
    builds.get.mockResolvedValueOnce(record("canceled"));
    await expect(service.cancel(scope())).resolves.toMatchObject({
      status: "canceled",
    });
    builds.get.mockResolvedValueOnce(record("succeeded"));
    await expect(service.cancel(scope())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

function scope() {
  return {
    teamId: "team-1",
    projectId: "project-1",
    releaseOrderId: "order-1",
    buildRunId: "run-1",
  };
}

function record(status: string) {
  return {
    id: "run-1",
    releaseOrderId: "order-1",
    revision: 1,
    sourceBranch: "main",
    sourceCommitSha: "a".repeat(40),
    status,
    inputHash: "hash",
    logReference: null,
    logSummary: null,
    gateSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: new Date(),
    finishedAt: status === "running" ? null : new Date(),
    createdAt: new Date(),
    manifest: null,
    inputSnapshot: null,
    repositoryIdentity: null,
    repositoryIdentityRevision: null,
  };
}
