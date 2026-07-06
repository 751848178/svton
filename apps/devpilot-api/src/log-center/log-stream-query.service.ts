import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListLogStreamsQueryDto } from "./dto/log-center.dto";
import { logStreamInclude } from "./log-center-includes.constants";

export type LogStreamRecord = Prisma.LogStreamGetPayload<{
  include: typeof logStreamInclude;
}>;

@Injectable()
export class LogStreamQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(teamId: string, query: ListLogStreamsQueryDto) {
    const where: Prisma.LogStreamWhereInput = { teamId };

    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.applicationServiceId)
      where.applicationServiceId = query.applicationServiceId;
    if (query.serverId) where.serverId = query.serverId;
    if (query.siteId) where.siteId = query.siteId;
    if (query.managedResourceId)
      where.managedResourceId = query.managedResourceId;

    return this.prisma.logStream.findMany({
      where,
      orderBy: [{ lastEntryAt: "desc" }, { updatedAt: "desc" }],
      include: logStreamInclude,
    });
  }

  async get(teamId: string, streamId: string): Promise<LogStreamRecord> {
    const stream = await this.prisma.logStream.findFirst({
      where: { id: streamId, teamId },
      include: logStreamInclude,
    });

    if (!stream) {
      throw new NotFoundException("日志流不存在");
    }

    return stream;
  }

  async accessScope(teamId: string, streamId: string) {
    const stream = await this.get(teamId, streamId);
    return {
      projectId: stream.projectId,
      environmentId: stream.environmentId,
    };
  }
}
