import { PrismaService } from "../prisma/prisma.service";

type ServerAgentTaskPullJobWhere = {
  teamId: string;
  serverId: string;
  transport: "server_agent";
};

export class ServerAgentTaskPullQueryService {
  constructor(private readonly prisma: PrismaService) {}

  readQueueSnapshot(where: ServerAgentTaskPullJobWhere, now: Date) {
    return Promise.all([
      this.countReadyJobs(where, now),
      this.countScheduledJobs(where, now),
      this.countJobs(where, "running"),
      this.countStaleRunningJobs(where, now),
      this.countJobs(where, "blocked"),
      this.countJobs(where, "failed"),
      this.countJobs(where, "cancelled"),
      this.readNextQueuedJob(where, now),
    ]);
  }

  private countReadyJobs(where: ServerAgentTaskPullJobWhere, now: Date) {
    return this.prisma.serverExecutionJob.count({
      where: {
        ...where,
        status: "queued",
        queueMode: "queued",
        availableAt: { lte: now },
      },
    });
  }

  private countScheduledJobs(where: ServerAgentTaskPullJobWhere, now: Date) {
    return this.prisma.serverExecutionJob.count({
      where: {
        ...where,
        status: "queued",
        queueMode: "queued",
        availableAt: { gt: now },
      },
    });
  }

  private countStaleRunningJobs(where: ServerAgentTaskPullJobWhere, now: Date) {
    return this.prisma.serverExecutionJob.count({
      where: {
        ...where,
        status: "running",
        lockExpiresAt: { lte: now },
      },
    });
  }

  private countJobs(where: ServerAgentTaskPullJobWhere, status: string) {
    return this.prisma.serverExecutionJob.count({
      where: { ...where, status },
    });
  }

  private readNextQueuedJob(where: ServerAgentTaskPullJobWhere, now: Date) {
    return this.prisma.serverExecutionJob.findFirst({
      where: {
        ...where,
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
        server: {
          select: { id: true, name: true, host: true, status: true },
        },
      },
    });
  }
}
