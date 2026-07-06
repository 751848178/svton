import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  ListLogCollectionRunsQueryDto,
  ListLogRetentionRunsQueryDto,
} from "./dto/log-center.dto";
import {
  logCollectionRunInclude,
  logRetentionRunInclude,
} from "./log-center-includes.constants";

@Injectable()
export class LogRunQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listCollectionRuns(
    teamId: string,
    query: ListLogCollectionRunsQueryDto,
  ) {
    const where: Prisma.LogCollectionRunWhereInput = { teamId };

    if (query.streamId) where.streamId = query.streamId;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;

    return this.prisma.logCollectionRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 100,
      include: logCollectionRunInclude,
    });
  }

  async listRetentionRuns(teamId: string, query: ListLogRetentionRunsQueryDto) {
    const where: Prisma.LogRetentionRunWhereInput = { teamId };

    if (query.streamId) where.streamId = query.streamId;
    if (query.status) where.status = query.status;
    if (query.dryRun !== undefined) where.dryRun = query.dryRun;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;

    return this.prisma.logRetentionRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 100,
      include: logRetentionRunInclude,
    });
  }
}
