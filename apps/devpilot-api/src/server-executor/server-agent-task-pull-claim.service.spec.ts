import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentAuthService } from "./server-agent-auth.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import {
  SERVER_AGENT_TASK_PULL_CLAIM_ENDPOINT,
  ServerAgentTaskPullClaimService,
} from "./server-agent-task-pull-claim.service";
import { ServerAgentTaskPullQueryService } from "./server-agent-task-pull-query.service";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";

describe("ServerAgentTaskPullClaimService", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("claims the next ready server_agent job for the requesting server", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-10T12:00:00.000Z"));

    const job = buildJob();
    const prisma = {
      server: { findFirst: jest.fn().mockResolvedValue(buildServer()) },
      serverExecutionJob: {
        findFirst: jest.fn().mockResolvedValue(job),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          ...job,
          startedAt: new Date("2026-07-10T12:00:00.000Z"),
          lockExpiresAt: new Date("2026-07-10T12:02:00.000Z"),
        }),
      },
    } as unknown as PrismaService;
    const service = buildService(prisma);

    const result = await service.claim(
      { "x-devpilot-agent-task-pull-token": "task-token" },
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-prod-1",
        runnerId: "runner-prod-1",
      },
    );

    expect(prisma.serverExecutionJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: "team-1",
          serverId: "server-1",
          transport: "server_agent",
          status: "queued",
          queueMode: "queued",
        }),
      }),
    );
    expect(prisma.serverExecutionJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "job-agent-next",
          teamId: "team-1",
          serverId: "server-1",
          transport: "server_agent",
          status: "queued",
          queueMode: "queued",
        }),
        data: expect.objectContaining({
          status: "running",
          lockOwner: "server-agent:agent-prod-1:runner-prod-1",
          startedAt: new Date("2026-07-10T12:00:00.000Z"),
          lockExpiresAt: new Date("2026-07-10T12:02:00.000Z"),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        accepted: true,
        claimed: true,
        reason: "server_agent_job_claimed",
        endpoint: SERVER_AGENT_TASK_PULL_CLAIM_ENDPOINT,
        claim: expect.objectContaining({
          mode: "claim_only",
          claimSupported: true,
          ackSupported: true,
          claimedTaskPayloadSupported: true,
          terminalWritebackSupported: true,
          lockOwner: "server-agent:agent-prod-1:runner-prod-1",
          lockExpiresAt: "2026-07-10T12:02:00.000Z",
        }),
        job: expect.objectContaining({
          id: "job-agent-next",
          operationKey: "log.collect.docker",
          logFollow: expect.objectContaining({
            kind: "log_follow",
            streamId: "stream-agent-1",
            requiredTransport: "server_agent",
          }),
        }),
        task: expect.objectContaining({
          available: true,
          jobId: "job-agent-next",
          lifecycle: expect.objectContaining({
            mode: "agent_terminal_command_steps",
            ack: expect.objectContaining({
              endpoint: "/server-agent/task-pull/ack",
              progressWritebackSupported: true,
              cancellationHintSupported: true,
            }),
            finish: expect.objectContaining({
              endpoint: "/server-agent/task-pull/finish",
              statuses: ["completed", "failed", "cancelled"],
            }),
          }),
          commandSteps: [
            expect.objectContaining({
              key: "collect",
              command: "docker logs --tail 100 app",
            }),
          ],
        }),
      }),
    );
    expect(result.job).not.toHaveProperty("inputSnapshot");
    expect(JSON.stringify(result)).not.toContain("inputSnapshot");
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
  return new ServerAgentTaskPullClaimService(
    prisma,
    new ServerAgentAuthService(configService, capabilityService),
    capabilityService,
    new ServerExecutorRuntimeConfigService(configService),
    new ServerAgentTaskPullQueryService(prisma),
  );
}

function buildServer() {
  return {
    id: "server-1",
    name: "prod-1",
    host: "10.0.0.1",
    status: "online",
    services: { serverAgent: true },
    tags: [],
  };
}

function buildJob() {
  return {
    id: "job-agent-next",
    operationKey: "log.collect.docker",
    adapterKey: "log-collection-plan",
    serverId: "server-1",
    attempt: 1,
    maxAttempts: 3,
    retryOfId: null,
    priority: 9,
    queuedAt: new Date("2026-07-10T11:58:00.000Z"),
    availableAt: new Date("2026-07-10T11:59:00.000Z"),
    startedAt: null,
    lockExpiresAt: null,
    inputSnapshot: {
      operationKey: "log.collect.docker",
      adapterKey: "log-collection-plan",
      dryRun: false,
      target: {
        transport: "server_agent",
        serverId: "server-1",
        serverHost: "10.0.0.1",
        agentRef: {
          source: "server_services",
          referenceId: "server-1",
          displayName: "Server agent",
          capabilityKey: "serverAgent",
          redacted: true,
        },
      },
      steps: [
        {
          key: "collect",
          label: "Collect docker logs",
          command: "docker logs --tail 100 app",
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
