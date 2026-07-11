import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ServerAgentHeartbeatDto,
  ServerAgentTaskPullClaimDto,
  ServerAgentTaskPullContractDto,
} from "./dto/server-execution-lease.dto";
import { HeaderBag, ServerAgentAuthService } from "./server-agent-auth.service";
import { ServerAgentTaskPullClaimService } from "./server-agent-task-pull-claim.service";
import { buildServerAgentTaskPullContract } from "./server-agent-task-pull-contract.utils";
import { ServerAgentTaskPullQueryService } from "./server-agent-task-pull-query.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import {
  isRecord,
  readStringArray,
  toJsonValue,
} from "./server-executor-json.utils";
import { PrismaService } from "../prisma/prisma.service";

type ServerAgentRuntimeServerRecord = {
  id: string;
  name: string;
  host: string;
  status: string;
  services: Prisma.JsonValue | null;
  tags: Prisma.JsonValue | null;
};

export class ServerAgentRuntimeEndpointService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentAuthService: ServerAgentAuthService,
    private readonly agentCapabilityService: ServerAgentCapabilityService,
    private readonly taskPullQueryService: ServerAgentTaskPullQueryService,
    private readonly taskPullClaimService: ServerAgentTaskPullClaimService,
  ) {}

  async recordHeartbeat(headers: HeaderBag, dto: ServerAgentHeartbeatDto) {
    this.agentAuthService.assertHeartbeatAuthorized(headers);

    const now = new Date();
    const server = await this.readServer(dto.teamId, dto.serverId);
    if (!server) {
      throw new NotFoundException("Server agent heartbeat 目标服务器不存在");
    }

    const ttlSeconds = this.agentAuthService.normalizeHeartbeatTtlSeconds(
      dto.ttlSeconds,
    );
    const services = isRecord(server.services) ? { ...server.services } : {};
    services.devpilotAgent = this.buildHeartbeat(dto, now, ttlSeconds);

    const updated = await this.prisma.server.update({
      where: { id: server.id },
      data: { services: toJsonValue(services) },
      select: serverSelect,
    });
    const runtime = this.agentCapabilityService.readRuntime(updated, now);

    return {
      accepted: true,
      server: {
        id: updated.id,
        name: updated.name,
        host: updated.host,
        status: updated.status,
      },
      agent: { runtime },
    };
  }

  async readTaskPullContract(
    headers: HeaderBag,
    dto: ServerAgentTaskPullContractDto,
  ) {
    this.agentAuthService.assertTaskPullContractAuthorized(headers);

    const now = new Date();
    const server = await this.readServer(dto.teamId, dto.serverId);
    if (!server) {
      throw new NotFoundException(
        "Server agent task-pull contract 目标服务器不存在",
      );
    }

    const serverAgentJobWhere = {
      teamId: dto.teamId,
      serverId: dto.serverId,
      transport: "server_agent" as const,
    };
    const [
      readyJobs,
      scheduledJobs,
      runningJobs,
      staleRunningJobs,
      blockedJobs,
      failedJobs,
      cancelledJobs,
      nextQueuedJob,
    ] = await this.taskPullQueryService.readQueueSnapshot(
      serverAgentJobWhere,
      now,
    );

    const runtime = this.agentCapabilityService.readRuntime(server, now);
    return buildServerAgentTaskPullContract({
      now,
      server: {
        id: server.id,
        name: server.name,
        host: server.host,
        status: server.status,
      },
      agentId: dto.agentId.trim(),
      runnerId: dto.runnerId?.trim() || undefined,
      requestedCapabilities: this.readCapabilities(dto.capabilities),
      agentRef: this.agentCapabilityService.readCapability(server),
      runtime: runtime || null,
      heartbeatRequired:
        this.agentCapabilityService.heartbeatRequiredForTargetSelection(),
      taskPullEnabled: this.agentAuthService.taskPullEnabled(),
      pollIntervalSeconds: this.agentAuthService.taskPullPollIntervalSeconds(),
      readyJobs,
      scheduledJobs,
      runningJobs,
      staleRunningJobs,
      blockedJobs,
      failedJobs,
      cancelledJobs,
      nextQueuedJob,
    });
  }

  claimTaskPullJob(headers: HeaderBag, dto: ServerAgentTaskPullClaimDto) {
    return this.taskPullClaimService.claim(headers, dto);
  }

  private async readServer(teamId: string, serverId: string) {
    return this.prisma.server.findFirst({
      where: { id: serverId, teamId },
      select: serverSelect,
    }) as Promise<ServerAgentRuntimeServerRecord | null>;
  }

  private buildHeartbeat(
    dto: ServerAgentHeartbeatDto,
    now: Date,
    ttlSeconds: number,
  ) {
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const capabilities = this.readCapabilities(dto.capabilities);
    return {
      enabled: true,
      source: "agent_heartbeat",
      status: this.agentAuthService.normalizeHeartbeatStatus(dto.status),
      agentId: dto.agentId.trim(),
      redacted: true,
      lastSeenAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      heartbeatTtlSeconds: ttlSeconds,
      ...(dto.hostname?.trim() ? { hostname: dto.hostname.trim() } : {}),
      ...(dto.runnerId?.trim() ? { runnerId: dto.runnerId.trim() } : {}),
      ...(dto.version?.trim() ? { version: dto.version.trim() } : {}),
      ...(capabilities.length ? { capabilities } : {}),
    };
  }

  private readCapabilities(value: unknown) {
    return readStringArray(value)
      .map((capability) => capability.trim())
      .filter(Boolean)
      .slice(0, 50);
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
