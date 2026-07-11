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

describe("ServerAgentTaskPullClaimService empty claim", () => {
  it("returns an empty claim result without mutating when no job is ready", async () => {
    const prisma = {
      server: {
        findFirst: jest.fn().mockResolvedValue({
          id: "server-1",
          name: "prod-1",
          host: "10.0.0.1",
          status: "online",
          services: { serverAgent: true },
          tags: [],
        }),
      },
      serverExecutionJob: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = buildService(prisma);

    await expect(
      service.claim(
        { "x-devpilot-agent-task-pull-token": "task-token" },
        { teamId: "team-1", serverId: "server-1", agentId: "agent-prod-1" },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        accepted: true,
        claimed: false,
        reason: "no_ready_server_agent_job",
        endpoint: SERVER_AGENT_TASK_PULL_CLAIM_ENDPOINT,
        job: null,
      }),
    );
    expect(prisma.serverExecutionJob.updateMany).not.toHaveBeenCalled();
  });

  it("returns disabled no-claim without touching the queue", async () => {
    const prisma = {
      server: {
        findFirst: jest.fn().mockResolvedValue({
          id: "server-1",
          name: "prod-1",
          host: "10.0.0.1",
          status: "online",
          services: { serverAgent: true },
          tags: [],
        }),
      },
      serverExecutionJob: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = buildService(prisma, {
      SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED: "false",
    });

    await expect(
      service.claim(
        { "x-devpilot-agent-task-pull-token": "task-token" },
        { teamId: "team-1", serverId: "server-1", agentId: "agent-prod-1" },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        accepted: true,
        claimed: false,
        reason: "task_pull_disabled",
        endpoint: SERVER_AGENT_TASK_PULL_CLAIM_ENDPOINT,
        job: null,
      }),
    );
    expect(prisma.serverExecutionJob.findFirst).not.toHaveBeenCalled();
    expect(prisma.serverExecutionJob.updateMany).not.toHaveBeenCalled();
  });
});

function buildService(
  prisma: PrismaService,
  overrides: Record<string, string> = {},
) {
  const configValues: Record<string, string> = {
    SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED: "true",
    SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN: "task-token",
    SERVER_EXECUTOR_QUEUE_LOCK_TTL_SECONDS: "120",
    ...overrides,
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
