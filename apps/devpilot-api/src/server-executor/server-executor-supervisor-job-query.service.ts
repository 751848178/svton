import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const SERVER_SELECT = { id: true, name: true, host: true, status: true };

/**
 * Job-status count and sample queries the supervisor snapshot needs for the
 * worker/queue/agent governance read-model.
 */
@Injectable()
export class ServerExecutorSupervisorJobQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async loadJobCounts(teamId: string, now: Date) {
    return Promise.all([
      this.prisma.serverExecutionJob.count({
        where: {
          teamId,
          status: "queued",
          queueMode: "queued",
          availableAt: { lte: now },
        },
      }),
      this.prisma.serverExecutionJob.count({
        where: {
          teamId,
          status: "queued",
          queueMode: "queued",
          availableAt: { gt: now },
        },
      }),
      this.prisma.serverExecutionJob.count({
        where: { teamId, status: "running" },
      }),
      this.prisma.serverExecutionJob.count({
        where: { teamId, status: "running", lockExpiresAt: { lte: now } },
      }),
      this.prisma.serverExecutionJob.count({
        where: { teamId, status: "blocked" },
      }),
      this.prisma.serverExecutionJob.count({
        where: { teamId, status: "failed" },
      }),
      this.prisma.serverExecutionJob.count({
        where: { teamId, status: "cancelled" },
      }),
    ]);
  }

  async loadNextQueuedJob(teamId: string, now: Date) {
    return this.prisma.serverExecutionJob.findFirst({
      where: {
        teamId,
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

  async loadWorkerLocks(teamId: string) {
    return this.prisma.serverExecutionJob.findMany({
      where: { teamId, status: "running", lockOwner: { not: null } },
      orderBy: [{ lastHeartbeatAt: "desc" }, { lockedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        operationKey: true,
        adapterKey: true,
        serverId: true,
        lockOwner: true,
        lastHeartbeatAt: true,
        lockExpiresAt: true,
        server: { select: SERVER_SELECT },
      },
    });
  }

  async loadStaleRemoteGovernanceJobs(teamId: string, now: Date) {
    return this.prisma.serverExecutionJob.findMany({
      where: { teamId, status: "running", lockExpiresAt: { lte: now } },
      orderBy: [{ lockExpiresAt: "asc" }, { lockedAt: "asc" }],
      take: 50,
      select: {
        id: true,
        operationKey: true,
        adapterKey: true,
        serverId: true,
        lockOwner: true,
        lastHeartbeatAt: true,
        lockExpiresAt: true,
        metadata: true,
        server: { select: SERVER_SELECT },
      },
    });
  }
}
