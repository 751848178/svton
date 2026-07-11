import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentAuthService, HeaderBag } from "./server-agent-auth.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";
import { buildServerAgentTaskPullJobSample } from "./server-agent-task-pull-gates.utils";
import { buildServerAgentTaskPullLockOwner } from "./server-agent-task-pull-lock.utils";
import { ServerAgentTaskPullQueryService } from "./server-agent-task-pull-query.service";
import { buildServerAgentClaimedTaskPayload } from "./server-agent-task-pull-task-payload.utils";
import { ServerAgentTaskPullClaimDto } from "./dto/server-execution-lease.dto";

export const SERVER_AGENT_TASK_PULL_CLAIM_ENDPOINT =
  "/server-agent/task-pull/claim";

type ServerAgentClaimServerRecord = {
  id: string;
  name: string;
  host: string;
  status: string;
  services: Prisma.JsonValue | null;
  tags: Prisma.JsonValue | null;
};

@Injectable()
export class ServerAgentTaskPullClaimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: ServerAgentAuthService,
    private readonly capabilityService: ServerAgentCapabilityService,
    private readonly runtimeConfigService: ServerExecutorRuntimeConfigService,
    private readonly taskPullQueryService: ServerAgentTaskPullQueryService,
  ) {}

  async claim(headers: HeaderBag, dto: ServerAgentTaskPullClaimDto) {
    this.authService.assertTaskPullTokenAuthorized(
      headers,
      "Server agent task-pull token 无效",
    );
    const taskPullEnabled = this.authService.taskPullEnabled();

    const now = new Date();
    const server = await this.readServer(dto.teamId, dto.serverId);
    if (!server) {
      throw new NotFoundException("Server agent task-pull 目标服务器不存在");
    }

    const agentRef = this.capabilityService.readCapability(server);
    const runtime = this.capabilityService.readRuntime(server, now);
    const base = this.buildBaseResponse(dto, server, now, agentRef, runtime);
    if (!taskPullEnabled) {
      return {
        ...base,
        ...this.noClaim("task_pull_disabled"),
      };
    }

    const lockOwner = this.buildLockOwner(dto);
    const lockExpiresAt = this.runtimeConfigService.lockExpiresAt(now);
    const job = await this.taskPullQueryService.claimNextReadyJob(
      {
        teamId: dto.teamId,
        serverId: dto.serverId,
        transport: "server_agent",
      },
      now,
      lockOwner,
      lockExpiresAt,
    );
    if (!job) return this.noClaim("no_ready_server_agent_job");

    return {
      ...base,
      claimed: true,
      reason: "server_agent_job_claimed",
      endpoint: SERVER_AGENT_TASK_PULL_CLAIM_ENDPOINT,
      claim: this.buildClaimMetadata(lockOwner, lockExpiresAt),
      job: buildServerAgentTaskPullJobSample(job),
      task: buildServerAgentClaimedTaskPayload(job, { teamId: dto.teamId }),
    };
  }

  private async readServer(teamId: string, serverId: string) {
    return this.prisma.server.findFirst({
      where: { id: serverId, teamId },
      select: serverSelect,
    }) as Promise<ServerAgentClaimServerRecord | null>;
  }

  private buildBaseResponse(
    dto: ServerAgentTaskPullClaimDto,
    server: ServerAgentClaimServerRecord,
    now: Date,
    agentRef: unknown,
    runtime: unknown,
  ) {
    return {
      accepted: true,
      generatedAt: now.toISOString(),
      server: {
        id: server.id,
        name: server.name,
        host: server.host,
        status: server.status,
      },
      agent: {
        agentId: dto.agentId.trim(),
        ...(dto.runnerId?.trim() ? { runnerId: dto.runnerId.trim() } : {}),
        ...(agentRef ? { agentRef } : {}),
        runtime: runtime || null,
      },
    };
  }

  private noClaim(reason: string) {
    return {
      accepted: true,
      claimed: false,
      reason,
      endpoint: SERVER_AGENT_TASK_PULL_CLAIM_ENDPOINT,
      job: null,
    };
  }

  private buildClaimMetadata(
    lockOwner: string | null,
    lockExpiresAt: Date | null,
  ) {
    return {
      mode: "claim_only",
      taskPullEnabled: true,
      pullEndpointImplemented: true,
      claimSupported: true,
      ackSupported: true,
      claimedTaskPayloadSupported: true,
      terminalWritebackSupported: true,
      lifecycleExecutionSupported: false,
      longConnectionSupported: false,
      lockOwner,
      lockExpiresAt: lockExpiresAt?.toISOString() || null,
      boundaries: [
        "claim_only",
        "ack_requires_follow_up",
        "finish_supported",
        "no_lifecycle_execution",
      ],
    };
  }

  private buildLockOwner(dto: ServerAgentTaskPullClaimDto) {
    return buildServerAgentTaskPullLockOwner(dto);
  }
}

const serverSelect = {
  id: true,
  name: true,
  host: true,
  status: true,
  services: true,
  tags: true,
} satisfies Prisma.ServerSelect;
