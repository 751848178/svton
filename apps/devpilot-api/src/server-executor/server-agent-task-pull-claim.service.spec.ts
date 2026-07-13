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
import { ServerCommandPolicyService } from "./server-command-policy.service";

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

  it("blocks a claimed job before returning command steps when command policy rejects it", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-10T12:00:00.000Z"));

    const job = buildJob({
      inputSnapshot: {
        ...buildJob().inputSnapshot,
        steps: [
          {
            key: "danger",
            label: "Danger",
            command: "rm -rf /",
            required: true,
            risk: "high",
          },
        ],
      },
    });
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
    const finishSyncService = {
      syncAfterPolicyBlocked: jest.fn().mockResolvedValue({
        businessRunSync: "log_collection",
        logCollectionRunId: "log-run-1",
        synced: true,
      }),
    };
    const service = buildService(
      prisma,
      {
        status: "blocked",
        policyKey: "test-policy",
        mode: "built_in_baseline",
        decisions: [
          {
            stepKey: "danger",
            label: "Danger",
            command: "rm -rf /",
            status: "blocked",
            ruleKey: "dangerous-rm-rf",
            reason: "dangerous command",
          },
        ],
        warnings: ["Danger: dangerous command"],
        blockedReasons: ["dangerous command"],
      },
      finishSyncService as never,
    );

    const result = await service.claim(
      { "x-devpilot-agent-task-pull-token": "task-token" },
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-prod-1",
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        accepted: true,
        claimed: false,
        reason: "command_policy_blocked",
        job: null,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("rm -rf");
    expect(prisma.serverExecutionJob.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: "job-agent-next",
          teamId: "team-1",
          serverId: "server-1",
          transport: "server_agent",
          status: "running",
          lockOwner: "server-agent:agent-prod-1:server-1",
        },
        data: expect.objectContaining({
          status: "blocked",
          error: expect.stringContaining("Server executor 命令策略阻断"),
          lockOwner: null,
          finishedAt: new Date("2026-07-10T12:00:00.000Z"),
          metadata: expect.objectContaining({
            existing: "metadata",
            taskPullClaimBlockedByCommandPolicy: true,
          }),
        }),
      }),
    );
    expect(finishSyncService.syncAfterPolicyBlocked).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ id: "job-agent-next" }),
      expect.objectContaining({ status: "blocked" }),
    );
  });

  it("does not claim jobs when online heartbeat identity belongs to another agent", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-10T12:00:00.000Z"));

    const prisma = {
      server: {
        findFirst: jest.fn().mockResolvedValue(
          buildServer({
            services: {
              serverAgent: true,
              devpilotAgent: {
                source: "agent_heartbeat",
                agentId: "agent-prod-2",
                runnerId: "runner-prod-2",
                status: "online",
                lastSeenAt: "2026-07-10T11:59:30.000Z",
                expiresAt: "2026-07-10T12:02:30.000Z",
              },
            },
          }),
        ),
      },
      serverExecutionJob: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
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

    expect(result).toEqual(
      expect.objectContaining({
        accepted: true,
        claimed: false,
        reason: "agent_runtime_identity_mismatch:agent_id",
        job: null,
      }),
    );
    expect(prisma.serverExecutionJob.findFirst).not.toHaveBeenCalled();
    expect(prisma.serverExecutionJob.updateMany).not.toHaveBeenCalled();
  });
});

function buildService(
  prisma: PrismaService,
  policyResult: Awaited<ReturnType<ServerCommandPolicyService["evaluate"]>> = {
    status: "passed",
    policyKey: "test-policy",
    mode: "built_in_baseline",
    decisions: [],
    warnings: [],
    blockedReasons: [],
  },
  finishSyncService = {
    syncAfterPolicyBlocked: jest.fn().mockResolvedValue(null),
  } as never,
) {
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
    { evaluate: jest.fn().mockResolvedValue(policyResult) } as never,
    finishSyncService,
  );
}

function buildServer(overrides: Record<string, unknown> = {}) {
  return {
    id: "server-1",
    name: "prod-1",
    host: "10.0.0.1",
    status: "online",
    services: { serverAgent: true },
    tags: [],
    ...overrides,
  };
}

function buildJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-agent-next",
    teamId: "team-1",
    actorId: "user-1",
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
    metadata: { existing: "metadata" },
    ...overrides,
  };
}
