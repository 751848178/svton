import type { Prisma } from "@prisma/client";
import { LogCollectionIngestionService } from "../log-center/log-collection-ingestion.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  ServerAgentTaskPullFinishSyncJob,
  ServerAgentTaskPullFinishSyncService,
} from "./server-agent-task-pull-finish-sync.service";

describe("ServerAgentTaskPullFinishSyncService", () => {
  it("syncs log collection runs after an agent finish writeback", async () => {
    const prisma = {
      logCollectionRun: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const ingestionService = {
      ingestCompletedRun: jest.fn().mockResolvedValue(undefined),
    } as unknown as LogCollectionIngestionService;
    const service = new ServerAgentTaskPullFinishSyncService(
      prisma,
      ingestionService,
    );

    const result = await service.syncAfterFinish(
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-1",
        jobId: "job-1",
        status: "completed",
        logs: [{ level: "info", message: "agent collected logs" }],
        result: { lineCount: 5 },
      },
      buildJob(),
    );

    expect(prisma.logCollectionRun.updateMany).toHaveBeenCalledWith({
      where: { id: "run-1", teamId: "team-1" },
      data: expect.objectContaining({
        serverExecutionJobId: "job-1",
        executorKey: "server-executor",
        adapterKey: "log-collection-plan",
        status: "completed",
        logs: [{ level: "info", message: "agent collected logs" }],
        result: { lineCount: 5 },
        error: null,
      }),
    });
    expect(ingestionService.ingestCompletedRun).toHaveBeenCalledWith(
      "team-1",
      "run-1",
    );
    expect(result).toEqual({
      businessRunSync: "log_collection",
      logCollectionRunId: "run-1",
      synced: true,
      completedIngestionAttempted: true,
    });
  });

  it("syncs non-log business runs through the linked sync boundary", async () => {
    const prisma = {
      deploymentRun: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const ingestionService = {
      ingestCompletedRun: jest.fn(),
    } as unknown as LogCollectionIngestionService;
    const service = new ServerAgentTaskPullFinishSyncService(
      prisma,
      ingestionService,
    );

    const result = await service.syncAfterFinish(
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-1",
        jobId: "job-1",
        status: "completed",
        logs: [{ level: "info", message: "agent deployed" }],
        result: { deploymentUrl: "https://app.example.test" },
      },
      {
        ...buildJob(),
        adapterKey: "server-agent",
        inputSnapshot: {
          ...(buildJob().inputSnapshot as Prisma.JsonObject),
          operationKey: "deployment.deploy",
          adapterKey: "server-agent",
          metadata: {
            businessRunSync: "deployment",
            deploymentRunId: "deployment-run-1",
          },
        },
      },
    );

    expect(prisma.deploymentRun.updateMany).toHaveBeenCalledWith({
      where: { id: "deployment-run-1", teamId: "team-1" },
      data: expect.objectContaining({
        serverExecutionJobId: "job-1",
        status: "completed",
        logs: [{ level: "info", message: "agent deployed" }],
        result: { deploymentUrl: "https://app.example.test" },
      }),
    });
    expect(ingestionService.ingestCompletedRun).not.toHaveBeenCalled();
    expect(result).toEqual({
      businessRunSync: "deployment",
      synced: true,
    });
  });

  it("skips snapshots without log collection sync metadata", async () => {
    const prisma = {
      logCollectionRun: { updateMany: jest.fn() },
    } as unknown as PrismaService;
    const ingestionService = {
      ingestCompletedRun: jest.fn(),
    } as unknown as LogCollectionIngestionService;
    const service = new ServerAgentTaskPullFinishSyncService(
      prisma,
      ingestionService,
    );

    await expect(
      service.syncAfterFinish(
        {
          teamId: "team-1",
          serverId: "server-1",
          agentId: "agent-1",
          jobId: "job-1",
          status: "failed",
          error: "agent failed",
        },
        { ...buildJob(), inputSnapshot: { metadata: {} } },
      ),
    ).resolves.toBeNull();
    expect(prisma.logCollectionRun.updateMany).not.toHaveBeenCalled();
    expect(ingestionService.ingestCompletedRun).not.toHaveBeenCalled();
  });

  it("syncs declared deployment runs after an agent finish writeback", async () => {
    const prisma = {
      deploymentRun: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      operationApproval: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const ingestionService = {
      ingestCompletedRun: jest.fn(),
    } as unknown as LogCollectionIngestionService;
    const service = new ServerAgentTaskPullFinishSyncService(
      prisma,
      ingestionService,
    );

    const result = await service.syncAfterFinish(
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-1",
        jobId: "job-1",
        status: "completed",
        logs: [{ level: "info", message: "deployment complete" }],
        result: { releaseId: "release-1" },
      },
      buildJobWithMetadata({
        businessRunSync: "deployment",
        deploymentRunId: "deploy-run-1",
        operationApprovalId: "approval-1",
      }),
    );

    expect(prisma.deploymentRun.updateMany).toHaveBeenCalledWith({
      where: { id: "deploy-run-1", teamId: "team-1" },
      data: expect.objectContaining({
        serverExecutionJobId: "job-1",
        status: "completed",
        logs: [{ level: "info", message: "deployment complete" }],
        result: { releaseId: "release-1" },
        error: undefined,
      }),
    });
    expect(prisma.operationApproval.updateMany).toHaveBeenCalledWith({
      where: {
        id: "approval-1",
        teamId: "team-1",
        status: "approved",
        consumedAt: null,
      },
      data: { consumedAt: expect.any(Date) },
    });
    expect(result).toEqual({
      businessRunSync: "deployment",
      synced: true,
    });
    expect(ingestionService.ingestCompletedRun).not.toHaveBeenCalled();
  });

  it("reports non-log sync attempts that did not match a linked run", async () => {
    const prisma = {
      deploymentRun: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      operationApproval: {
        updateMany: jest.fn(),
      },
    } as unknown as PrismaService;
    const ingestionService = {
      ingestCompletedRun: jest.fn(),
    } as unknown as LogCollectionIngestionService;
    const service = new ServerAgentTaskPullFinishSyncService(
      prisma,
      ingestionService,
    );

    const result = await service.syncAfterFinish(
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-1",
        jobId: "job-1",
        status: "failed",
        error: "agent failed",
      },
      buildJobWithMetadata({
        businessRunSync: "deployment",
        deploymentRunId: "missing-run",
        operationApprovalId: "approval-1",
      }),
    );

    expect(result).toEqual({
      businessRunSync: "deployment",
      synced: false,
    });
    expect(prisma.operationApproval.updateMany).not.toHaveBeenCalled();
    expect(ingestionService.ingestCompletedRun).not.toHaveBeenCalled();
  });

  it("does not ingest completed logs when the linked run was not updated", async () => {
    const prisma = {
      logCollectionRun: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService;
    const ingestionService = {
      ingestCompletedRun: jest.fn(),
    } as unknown as LogCollectionIngestionService;
    const service = new ServerAgentTaskPullFinishSyncService(
      prisma,
      ingestionService,
    );

    const result = await service.syncAfterFinish(
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-1",
        jobId: "job-1",
        status: "completed",
      },
      buildJob(),
    );

    expect(result).toEqual({
      businessRunSync: "log_collection",
      logCollectionRunId: "run-1",
      synced: false,
      completedIngestionAttempted: false,
    });
    expect(ingestionService.ingestCompletedRun).not.toHaveBeenCalled();
  });
});

function buildJob(): ServerAgentTaskPullFinishSyncJob {
  return {
    id: "job-1",
    teamId: "team-1",
    actorId: "user-1",
    retryOfId: null,
    attempt: 1,
    maxAttempts: 3,
    adapterKey: "log-collection-plan",
    inputSnapshot: {
      operationKey: "log.collect.docker",
      adapterKey: "log-collection-plan",
      dryRun: false,
      target: { transport: "server_agent", serverId: "server-1" },
      steps: [
        {
          key: "collect",
          label: "Collect logs",
          command: "tail -n 10 /var/log/app.log",
          required: true,
        },
      ],
      metadata: {
        businessRunSync: "log_collection",
        logCollectionRunId: "run-1",
      },
    },
  };
}

function buildJobWithMetadata(
  metadata: Prisma.JsonObject,
): ServerAgentTaskPullFinishSyncJob {
  return {
    ...buildJob(),
    inputSnapshot: {
      ...(buildJob().inputSnapshot as Prisma.JsonObject),
      metadata,
    },
  };
}
