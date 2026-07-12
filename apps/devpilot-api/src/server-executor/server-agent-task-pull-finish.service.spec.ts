import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentAuthService } from "./server-agent-auth.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import {
  SERVER_AGENT_TASK_PULL_FINISH_ENDPOINT,
  ServerAgentTaskPullFinishService,
} from "./server-agent-task-pull-finish.service";
import { ServerAgentTaskPullFinishSyncService } from "./server-agent-task-pull-finish-sync.service";

describe("ServerAgentTaskPullFinishService", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("rejects when task-pull is disabled before mutating or syncing", async () => {
    const prisma = {
      serverExecutionJob: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;
    const syncService = buildSyncServiceMock(null);
    const service = buildService(prisma, syncService, {
      SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED: "false",
    });

    await expect(
      service.finish(
        { "x-devpilot-agent-task-pull-token": "task-token" },
        {
          teamId: "team-1",
          serverId: "server-1",
          agentId: "agent-prod-1",
          jobId: "job-agent-running",
          status: "completed",
        },
      ),
    ).rejects.toThrow("Server agent task-pull 未启用");
    expect(prisma.serverExecutionJob.findFirst).not.toHaveBeenCalled();
    expect(prisma.serverExecutionJob.updateMany).not.toHaveBeenCalled();
    expect(prisma.serverExecutionJob.findUnique).not.toHaveBeenCalled();
    expect(syncService.syncAfterFinish).not.toHaveBeenCalled();
  });

  it("rejects invalid task-pull tokens before mutating or syncing", async () => {
    const prisma = {
      serverExecutionJob: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;
    const syncService = buildSyncServiceMock(null);
    const service = buildService(prisma, syncService);

    await expect(
      service.finish(
        { "x-devpilot-agent-task-pull-token": "wrong-token" },
        {
          teamId: "team-1",
          serverId: "server-1",
          agentId: "agent-prod-1",
          jobId: "job-agent-running",
          status: "completed",
        },
      ),
    ).rejects.toThrow("Server agent task-pull token 无效");
    expect(prisma.serverExecutionJob.findFirst).not.toHaveBeenCalled();
    expect(prisma.serverExecutionJob.updateMany).not.toHaveBeenCalled();
    expect(prisma.serverExecutionJob.findUnique).not.toHaveBeenCalled();
    expect(syncService.syncAfterFinish).not.toHaveBeenCalled();
  });

  it("writes a terminal result for a claimed running server_agent job", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-10T12:10:00.000Z"));

    const prisma = {
      serverExecutionJob: {
        findFirst: jest.fn().mockResolvedValue(buildJob()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(buildJob()),
      },
    } as unknown as PrismaService;
    const syncService = buildSyncServiceMock({
      businessRunSync: "log_collection",
      logCollectionRunId: "run-1",
      synced: true,
      completedIngestionAttempted: true,
    });
    const service = buildService(prisma, syncService);

    const result = await service.finish(
      { "x-devpilot-agent-task-pull-token": "task-token" },
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-prod-1",
        runnerId: "runner-prod-1",
        jobId: "job-agent-running",
        status: "completed",
        logs: [{ level: "info", message: "agent finished" }],
        result: { mode: "agent_task_pull", exitCode: 0 },
      },
    );

    expect(prisma.serverExecutionJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-agent-running",
        teamId: "team-1",
        serverId: "server-1",
        transport: "server_agent",
        status: "running",
        lockOwner: "server-agent:agent-prod-1:runner-prod-1",
      },
      data: {
        status: "completed",
        commandPlan: expect.objectContaining({
          mode: "agent_task_pull_terminal_summary",
          terminal: expect.objectContaining({ status: "completed" }),
        }),
        logs: [{ level: "info", message: "agent finished" }],
        result: { mode: "agent_task_pull", exitCode: 0 },
        error: undefined,
        lockedAt: null,
        lockOwner: null,
        lockExpiresAt: null,
        lastHeartbeatAt: null,
        cancelledAt: undefined,
        finishedAt: new Date("2026-07-10T12:10:00.000Z"),
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        accepted: true,
        finished: true,
        reason: "server_agent_job_finished",
        endpoint: SERVER_AGENT_TASK_PULL_FINISH_ENDPOINT,
        finish: expect.objectContaining({
          mode: "terminal_writeback",
          status: "completed",
          terminalWritebackSupported: true,
          lockReleased: true,
          linkedRunSync: expect.objectContaining({
            businessRunSync: "log_collection",
            synced: true,
          }),
        }),
        job: expect.objectContaining({ id: "job-agent-running" }),
      }),
    );
    expect(result.job).not.toHaveProperty("inputSnapshot");
    expect(syncService.syncAfterFinish).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-agent-running" }),
      expect.objectContaining({ id: "job-agent-running" }),
    );
  });

  it("does not finish when the job lock owner does not match the agent", async () => {
    const prisma = {
      serverExecutionJob: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;
    const syncService = buildSyncServiceMock(null);
    const service = buildService(prisma, syncService);

    await expect(
      service.finish(
        { "x-devpilot-agent-task-pull-token": "task-token" },
        {
          teamId: "team-1",
          serverId: "server-1",
          agentId: "agent-prod-1",
          jobId: "job-1",
          status: "failed",
          error: "agent command failed",
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        accepted: true,
        finished: false,
        reason: "claimed_job_not_found_or_lock_mismatch",
        endpoint: SERVER_AGENT_TASK_PULL_FINISH_ENDPOINT,
        job: null,
      }),
    );
    expect(prisma.serverExecutionJob.updateMany).not.toHaveBeenCalled();
    expect(prisma.serverExecutionJob.findUnique).not.toHaveBeenCalled();
    expect(syncService.syncAfterFinish).not.toHaveBeenCalled();
  });

  it("writes fallback terminal logs and result when the agent omits them", async () => {
    const prisma = {
      serverExecutionJob: {
        findFirst: jest.fn().mockResolvedValue(buildJob()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(buildJob()),
      },
    } as unknown as PrismaService;
    const syncService = buildSyncServiceMock(null);
    const service = buildService(prisma, syncService);

    await service.finish(
      { "x-devpilot-agent-task-pull-token": "task-token" },
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-prod-1",
        jobId: "job-agent-running",
        status: "failed",
        error: "agent failed before result upload",
      },
    );

    expect(prisma.serverExecutionJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          logs: [
            expect.objectContaining({
              level: "warn",
              serverExecutionJobId: "job-agent-running",
            }),
          ],
          result: {
            mode: "agent_task_pull_terminal_writeback",
            serverExecutionJobId: "job-agent-running",
            status: "failed",
          },
        }),
      }),
    );
    expect(syncService.syncAfterFinish).toHaveBeenCalledWith(
      expect.objectContaining({
        logs: expect.any(Array),
        result: expect.objectContaining({ status: "failed" }),
      }),
      expect.objectContaining({ id: "job-agent-running" }),
    );
  });
});

function buildService(
  prisma: PrismaService,
  syncService: Pick<ServerAgentTaskPullFinishSyncService, "syncAfterFinish">,
  overrides: Record<string, string> = {},
) {
  const configValues: Record<string, string> = {
    SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED: "true",
    SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN: "task-token",
    ...overrides,
  };
  const configService = {
    get: jest.fn(
      (key: string, fallback?: string | number) =>
        configValues[key] ?? fallback,
    ),
  } as unknown as ConfigService;
  const capabilityService = new ServerAgentCapabilityService(configService);
  return new ServerAgentTaskPullFinishService(
    prisma,
    new ServerAgentAuthService(configService, capabilityService),
    syncService as ServerAgentTaskPullFinishSyncService,
  );
}

function buildSyncServiceMock(
  result: Awaited<
    ReturnType<ServerAgentTaskPullFinishSyncService["syncAfterFinish"]>
  >,
) {
  return {
    syncAfterFinish: jest.fn().mockResolvedValue(result),
  };
}

function buildJob() {
  return {
    id: "job-agent-running",
    teamId: "team-1",
    actorId: "user-1",
    retryOfId: null,
    attempt: 1,
    maxAttempts: 3,
    operationKey: "log.collect.docker",
    adapterKey: "log-collection-plan",
    serverId: "server-1",
    priority: 9,
    queuedAt: new Date("2026-07-10T11:58:00.000Z"),
    availableAt: new Date("2026-07-10T11:59:00.000Z"),
    inputSnapshot: {
      operationKey: "log.collect.docker",
      adapterKey: "log-collection-plan",
      dryRun: false,
      target: {
        transport: "server_agent",
        serverId: "server-1",
        serverHost: "10.0.0.1",
      },
      steps: [
        {
          key: "collect",
          label: "Collect docker logs",
          command: "docker logs app",
          required: true,
          risk: "low",
        },
      ],
      metadata: {
        logStreamId: "stream-agent-1",
        params: { followMode: "agent", requiredTransport: "server_agent" },
      },
    },
    server: {
      id: "server-1",
      name: "prod-1",
      host: "10.0.0.1",
      status: "online",
    },
  };
}
