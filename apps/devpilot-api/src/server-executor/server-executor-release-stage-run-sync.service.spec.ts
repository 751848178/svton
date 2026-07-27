/**
 * ServerExecutorReleaseStageRunSyncService 单元测试：验证 metadata 缺失短路、
 * late-binding 回填幂等、coordinator 缺席时不抛错、coordinator 异常被吞。
 */
import { ServerExecutorReleaseStageRunSyncService } from "./server-executor-release-stage-run-sync.service";
import type { ReleaseCoordinatorPort } from "../release-orchestration/release-coordinator.port";
import type { PrismaService } from "../prisma/prisma.service";

function buildResult(status: "completed" | "failed") {
  return {
    status,
    mode: "executed",
    executorKey: "server-executor",
    adapterKey: "ssh-live",
    executable: true,
    warnings: [],
    commandSteps: [],
    commandPlan: { steps: [] },
    logs: [{ stream: "stdout", message: "ok" }],
    result: { exitCode: 0 },
    error: status === "failed" ? "boom" : undefined,
  } as never;
}

describe("ServerExecutorReleaseStageRunSyncService", () => {
  it("returns false when metadata lacks releasePlanId/stageAttemptId", async () => {
    const updateMany = jest.fn();
    const prisma = { releaseStageAttempt: { updateMany } } as unknown as PrismaService;
    const svc = new ServerExecutorReleaseStageRunSyncService(prisma);
    const synced = await svc.syncAfterExecution(
      { teamId: "t1" } as never,
      "job-1",
      buildResult("completed"),
      {},
    );
    expect(synced).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("backfills serverExecutionJobId (idempotent where null) and calls coordinator", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { releaseStageAttempt: { updateMany } } as unknown as PrismaService;
    const finalize = jest.fn().mockResolvedValue(undefined);
    const coordinator = { finalizeAndAdvance: finalize } as unknown as ReleaseCoordinatorPort;
    const svc = new ServerExecutorReleaseStageRunSyncService(prisma, coordinator);

    const synced = await svc.syncAfterExecution(
      { teamId: "t1" } as never,
      "job-1",
      buildResult("completed"),
      { releasePlanId: "plan-1", stageAttemptId: "att-1" },
    );

    expect(synced).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "att-1", serverExecutionJobId: null },
      data: { serverExecutionJobId: "job-1" },
    });
    expect(finalize).toHaveBeenCalledWith("plan-1", "att-1", {
      kind: "serverExecutionJob",
      id: "job-1",
      result: expect.objectContaining({ status: "completed" }),
    });
  });

  it("does not rethrow when coordinator.finalizeAndAdvance throws", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = { releaseStageAttempt: { updateMany } } as unknown as PrismaService;
    const finalize = jest.fn().mockRejectedValue(new Error("coordinator down"));
    const coordinator = { finalizeAndAdvance: finalize } as unknown as ReleaseCoordinatorPort;
    const svc = new ServerExecutorReleaseStageRunSyncService(prisma, coordinator);

    await expect(
      svc.syncAfterExecution(
        { teamId: "t1" } as never,
        "job-1",
        buildResult("completed"),
        { releasePlanId: "plan-1", stageAttemptId: "att-1" },
      ),
    ).resolves.toBe(true);
  });

  it("syncAfterFailure sends failed terminal with error message", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { releaseStageAttempt: { updateMany } } as unknown as PrismaService;
    const finalize = jest.fn().mockResolvedValue(undefined);
    const coordinator = { finalizeAndAdvance: finalize } as unknown as ReleaseCoordinatorPort;
    const svc = new ServerExecutorReleaseStageRunSyncService(prisma, coordinator);

    await svc.syncAfterFailure(
      { teamId: "t1" } as never,
      "job-1",
      new Error("exit 1"),
      { releasePlanId: "plan-1", stageAttemptId: "att-1" },
    );

    expect(finalize).toHaveBeenCalledWith("plan-1", "att-1", {
      kind: "serverExecutionJob",
      id: "job-1",
      result: { status: "failed", error: "exit 1" },
    });
  });

  it("syncAfterFailure with no coordinator still backfills and returns", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { releaseStageAttempt: { updateMany } } as unknown as PrismaService;
    const svc = new ServerExecutorReleaseStageRunSyncService(prisma);

    await expect(
      svc.syncAfterFailure(
        { teamId: "t1" } as never,
        "job-1",
        "string error",
        { releasePlanId: "plan-1", stageAttemptId: "att-1" },
      ),
    ).resolves.toBeUndefined();
    expect(updateMany).toHaveBeenCalled();
  });
});
