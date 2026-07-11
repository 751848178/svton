import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const SERVER_SELECT = { id: true, name: true, host: true, status: true };

/**
 * Agent-transport-scoped job queries the supervisor snapshot needs for the
 * server-agent fleet/readiness/task-pull read-models.
 */
@Injectable()
export class ServerExecutorSupervisorAgentJobQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async loadAgentJobCounts(teamId: string, now: Date) {
    return Promise.all([
      this.prisma.serverExecutionJob.count({
        where: {
          teamId,
          transport: "server_agent",
          status: "queued",
          queueMode: "queued",
          availableAt: { lte: now },
        },
      }),
      this.prisma.serverExecutionJob.count({
        where: {
          teamId,
          transport: "server_agent",
          status: "queued",
          queueMode: "queued",
          availableAt: { gt: now },
        },
      }),
      this.prisma.serverExecutionJob.count({
        where: { teamId, transport: "server_agent", status: "running" },
      }),
      this.prisma.serverExecutionJob.count({
        where: {
          teamId,
          transport: "server_agent",
          status: "running",
          lockExpiresAt: { lte: now },
        },
      }),
      this.prisma.serverExecutionJob.count({
        where: { teamId, transport: "server_agent", status: "blocked" },
      }),
      this.prisma.serverExecutionJob.count({
        where: { teamId, transport: "server_agent", status: "failed" },
      }),
      this.prisma.serverExecutionJob.count({
        where: { teamId, transport: "server_agent", status: "cancelled" },
      }),
    ]);
  }

  async loadAgentNextQueuedJob(teamId: string, now: Date) {
    return this.prisma.serverExecutionJob.findFirst({
      where: {
        teamId,
        transport: "server_agent",
        status: "queued",
        queueMode: "queued",
        availableAt: { lte: now },
      },
      orderBy: [{ priority: "desc" }, { queuedAt: "asc" }],
      select: {
        id: true,
        operationKey: true,
        adapterKey: true,
        serverId: true,
        priority: true,
        queuedAt: true,
        availableAt: true,
        server: { select: SERVER_SELECT },
      },
    });
  }

  async loadAgentBlockedReasonJobs(teamId: string) {
    return this.prisma.serverExecutionJob.findMany({
      where: { teamId, transport: "server_agent", status: "blocked" },
      orderBy: [{ finishedAt: "desc" }, { queuedAt: "desc" }],
      take: 20,
      select: {
        id: true,
        operationKey: true,
        adapterKey: true,
        serverId: true,
        queuedAt: true,
        finishedAt: true,
        error: true,
        result: true,
        server: { select: SERVER_SELECT },
      },
    });
  }

  async loadAgentFleetJobs(teamId: string) {
    return this.prisma.serverExecutionJob.findMany({
      where: {
        teamId,
        transport: "server_agent",
        status: { in: ["queued", "running", "blocked", "failed", "cancelled"] },
      },
      orderBy: [{ queuedAt: "desc" }],
      take: 200,
      select: {
        id: true,
        operationKey: true,
        adapterKey: true,
        serverId: true,
        status: true,
        queueMode: true,
        priority: true,
        queuedAt: true,
        availableAt: true,
        lockExpiresAt: true,
        finishedAt: true,
        error: true,
        result: true,
        metadata: true,
        server: { select: SERVER_SELECT },
      },
    });
  }
}
