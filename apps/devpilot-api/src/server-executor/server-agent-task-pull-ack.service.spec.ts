import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentAuthService } from "./server-agent-auth.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import {
  SERVER_AGENT_TASK_PULL_ACK_ENDPOINT,
  ServerAgentTaskPullAckService,
} from "./server-agent-task-pull-ack.service";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";

describe("ServerAgentTaskPullAckService", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("acknowledges a claimed running server_agent job and renews the lock", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-10T12:05:00.000Z"));

    const job = buildJob();
    const prisma = {
      serverExecutionJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(job),
      },
    } as unknown as PrismaService;
    const service = buildService(prisma);

    const result = await service.ack(
      { "x-devpilot-agent-task-pull-token": "task-token" },
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-prod-1",
        runnerId: "runner-prod-1",
        jobId: "job-agent-running",
      },
    );

    expect(prisma.serverExecutionJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "job-agent-running",
          teamId: "team-1",
          serverId: "server-1",
          transport: "server_agent",
          status: "running",
          lockOwner: "server-agent:agent-prod-1:runner-prod-1",
        },
        data: {
          lastHeartbeatAt: new Date("2026-07-10T12:05:00.000Z"),
          lockExpiresAt: new Date("2026-07-10T12:07:00.000Z"),
        },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        accepted: true,
        acked: true,
        reason: "server_agent_job_acknowledged",
        endpoint: SERVER_AGENT_TASK_PULL_ACK_ENDPOINT,
        ack: expect.objectContaining({
          mode: "ack_only",
          ackSupported: true,
          cancellationHintSupported: true,
          lifecycleExecutionSupported: false,
          terminalWritebackSupported: true,
          lockOwner: "server-agent:agent-prod-1:runner-prod-1",
          lockExpiresAt: "2026-07-10T12:07:00.000Z",
        }),
        job: expect.objectContaining({
          id: "job-agent-running",
          operationKey: "log.collect.docker",
          logFollow: expect.objectContaining({
            kind: "log_follow",
            streamId: "stream-agent-1",
            requiredTransport: "server_agent",
          }),
        }),
        cancellation: null,
      }),
    );
    expect(result.job).not.toHaveProperty("inputSnapshot");
  });

  it("returns a cancellation hint for a claimed running job with cancel requested", async () => {
    const prisma = {
      serverExecutionJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(
          buildJob({
            cancelRequestedAt: new Date("2026-07-10T12:06:00.000Z"),
            error: "执行任务已由 user-1 请求取消",
          }),
        ),
      },
    } as unknown as PrismaService;
    const service = buildService(prisma);

    const result = await service.ack(
      { "x-devpilot-agent-task-pull-token": "task-token" },
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-prod-1",
        jobId: "job-agent-running",
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        acked: true,
        cancellation: {
          requested: true,
          shouldStop: true,
          requestedAt: "2026-07-10T12:06:00.000Z",
          finishStatus: "cancelled",
          reason: "执行任务已由 user-1 请求取消",
          serverExecutionJobId: "job-agent-running",
        },
      }),
    );
    expect(prisma.serverExecutionJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lockExpiresAt: expect.any(Date) }),
      }),
    );
  });

  it("records optional ack progress under the claimed job lock", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-10T12:08:00.000Z"));

    const job = buildJob({ metadata: { existing: true } });
    const prisma = {
      serverExecutionJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(job),
      },
    } as unknown as PrismaService;
    const service = buildService(prisma);

    const result = await service.ack(
      { "x-devpilot-agent-task-pull-token": "task-token" },
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-prod-1",
        runnerId: "runner-prod-1",
        jobId: "job-agent-running",
        progress: {
          stepKey: "deploy",
          percent: 50,
          message: "halfway",
        },
      },
    );

    expect(prisma.serverExecutionJob.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: "job-agent-running",
          status: "running",
          lockOwner: "server-agent:agent-prod-1:runner-prod-1",
        },
        data: {
          metadata: {
            existing: true,
            taskPullProgress: {
              updatedAt: "2026-07-10T12:08:00.000Z",
              agentId: "agent-prod-1",
              runnerId: "runner-prod-1",
              progress: {
                stepKey: "deploy",
                percent: 50,
                message: "halfway",
              },
            },
          },
        },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        acked: true,
        ack: expect.objectContaining({
          progressWritebackSupported: true,
        }),
        progress: {
          recorded: true,
          updatedAt: "2026-07-10T12:08:00.000Z",
          serverExecutionJobId: "job-agent-running",
        },
      }),
    );
  });

  it("does not renew when the job lock owner does not match the agent", async () => {
    const prisma = {
      serverExecutionJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = buildService(prisma);

    await expect(
      service.ack(
        { "x-devpilot-agent-task-pull-token": "task-token" },
        {
          teamId: "team-1",
          serverId: "server-1",
          agentId: "agent-prod-1",
          jobId: "job-1",
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        accepted: true,
        acked: false,
        reason: "claimed_job_not_found_or_lock_mismatch",
        endpoint: SERVER_AGENT_TASK_PULL_ACK_ENDPOINT,
        job: null,
      }),
    );
    expect(prisma.serverExecutionJob.findUnique).not.toHaveBeenCalled();
  });
});

function buildService(prisma: PrismaService) {
  const configValues: Record<string, string> = {
    SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED: "true",
    SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN: "task-token",
    SERVER_EXECUTOR_QUEUE_LOCK_TTL_SECONDS: "120",
  };
  const configService = {
    get: jest.fn(
      (key: string, fallback?: string | number) =>
        configValues[key] ?? fallback,
    ),
  } as unknown as ConfigService;
  const capabilityService = new ServerAgentCapabilityService(configService);
  return new ServerAgentTaskPullAckService(
    prisma,
    new ServerAgentAuthService(configService, capabilityService),
    new ServerExecutorRuntimeConfigService(configService),
  );
}

function buildJob(
  overrides: Partial<{
    cancelRequestedAt: Date | null;
    error: string | null;
    metadata: unknown;
  }> = {},
) {
  return {
    id: "job-agent-running",
    operationKey: "log.collect.docker",
    adapterKey: "log-collection-plan",
    serverId: "server-1",
    priority: 9,
    queuedAt: new Date("2026-07-10T11:58:00.000Z"),
    availableAt: new Date("2026-07-10T11:59:00.000Z"),
    cancelRequestedAt: null,
    error: null,
    metadata: null,
    inputSnapshot: {
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
    ...overrides,
  };
}
