import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  ListServerExecutionJobsQueryDto,
  ListServerExecutionLeasesQueryDto,
} from "./dto/server-execution-lease.dto";
import { buildServerExecutionJobInclude } from "./server-executor-job-include.utils";

export class ServerExecutorReadQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expireStaleLeases: (
      now: Date,
      teamId?: string,
    ) => Promise<number | { count: number }>,
  ) {}

  async listLeases(teamId: string, query: ListServerExecutionLeasesQueryDto) {
    await this.expireStaleLeases(new Date(), teamId);

    const where: Prisma.ServerExecutionLeaseWhereInput = { teamId };
    if (query.status) where.status = query.status;
    if (query.serverId) where.serverId = query.serverId;
    if (query.operationKey) where.operationKey = query.operationKey;
    if (query.adapterKey) where.adapterKey = query.adapterKey;

    return this.prisma.serverExecutionLease.findMany({
      where,
      orderBy: { acquiredAt: "desc" },
      take: 100,
      include: {
        actor: { select: { id: true, name: true, email: true } },
        server: { select: { id: true, name: true, host: true, status: true } },
      },
    });
  }

  async expireStaleLeasesForTeam(teamId: string) {
    const expired = await this.expireStaleLeases(new Date(), teamId);
    return { expired: typeof expired === "number" ? expired : expired.count };
  }

  listJobs(teamId: string, query: ListServerExecutionJobsQueryDto) {
    const where: Prisma.ServerExecutionJobWhereInput = { teamId };
    if (query.status) where.status = query.status;
    if (query.serverId) where.serverId = query.serverId;
    if (query.operationKey) where.operationKey = query.operationKey;
    if (query.adapterKey) where.adapterKey = query.adapterKey;
    if (query.queueMode) where.queueMode = query.queueMode;

    return this.prisma.serverExecutionJob.findMany({
      where,
      orderBy: { queuedAt: "desc" },
      take: 100,
      include: buildServerExecutionJobInclude(),
    });
  }
}
