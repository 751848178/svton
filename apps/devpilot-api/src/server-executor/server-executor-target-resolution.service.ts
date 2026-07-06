import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import { ServerExecutorTarget } from "./server-executor.types";

type ServerExecutorTargetServerRecord = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: string;
  services: Prisma.JsonValue | null;
  tags: Prisma.JsonValue | null;
};

export class ServerExecutorTargetResolutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentCapabilityService: ServerAgentCapabilityService,
    private readonly agentTargetEnabled: () => boolean,
  ) {}

  async resolveTarget(
    teamId: string,
    serverId?: string | null,
  ): Promise<ServerExecutorTarget> {
    if (!serverId) {
      return { transport: "none", serverId: null };
    }

    const server = await this.readServer(teamId, serverId);
    if (!server) {
      throw new NotFoundException("服务器不存在或不属于当前团队");
    }

    const baseTarget = this.buildBaseTarget(server);
    const agentRef = this.agentTargetEnabled()
      ? this.agentCapabilityService.readCapability(server)
      : undefined;
    const agentRuntime = this.agentCapabilityService.readRuntime(
      server,
      new Date(),
    );

    if (
      agentRef &&
      this.agentCapabilityService.isTargetRuntimeEligible(agentRuntime)
    ) {
      return {
        ...baseTarget,
        transport: "server_agent",
        agentRef,
      };
    }

    return {
      ...baseTarget,
      transport: "ssh",
    };
  }

  private async readServer(teamId: string, serverId: string) {
    return this.prisma.server.findFirst({
      where: { id: serverId, teamId },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
        services: true,
        tags: true,
      },
    }) as Promise<ServerExecutorTargetServerRecord | null>;
  }

  private buildBaseTarget(server: ServerExecutorTargetServerRecord) {
    return {
      serverId: server.id,
      serverName: server.name,
      serverHost: server.host,
      port: server.port,
      username: server.username,
      authType: server.authType,
      credentialRef: {
        source: "server" as const,
        referenceId: server.id,
        displayName: `${server.username}@${server.host}:${server.port}`,
        redacted: true as const,
      },
    };
  }
}
