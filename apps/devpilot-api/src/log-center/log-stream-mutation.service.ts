import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLogStreamDto, UpdateLogStreamDto } from "./dto/log-center.dto";
import { logStreamInclude } from "./log-center-includes.constants";
import { toJsonValue } from "./log-center-value.utils";
import { LogStreamTargetContextService } from "./log-stream-target-context.service";

type LogStreamMutationRecord = {
  id: string;
};

@Injectable()
export class LogStreamMutationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logStreamTargetContextService: LogStreamTargetContextService,
  ) {}

  async resolveCreateAccessScope(teamId: string, dto: CreateLogStreamDto) {
    const target = await this.logStreamTargetContextService.resolve(
      teamId,
      dto,
    );
    return {
      projectId: target.projectId ?? null,
      environmentId: target.environmentId ?? null,
    };
  }

  async create(teamId: string, userId: string, dto: CreateLogStreamDto) {
    const target = await this.logStreamTargetContextService.resolve(
      teamId,
      dto,
    );
    const { sourceType: targetSourceType, ...targetData } = target;

    return this.prisma.logStream.create({
      data: {
        teamId,
        createdById: userId,
        ...targetData,
        name: dto.name,
        sourceType: dto.sourceType || targetSourceType || "manual",
        sourceKey: dto.sourceKey,
        retentionDays: dto.retentionDays || 14,
        labels: dto.labels ? toJsonValue(dto.labels) : undefined,
        metadata: dto.metadata ? toJsonValue(dto.metadata) : undefined,
      },
      include: logStreamInclude,
    });
  }

  async update(stream: LogStreamMutationRecord, dto: UpdateLogStreamDto) {
    const data: Prisma.LogStreamUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.retentionDays !== undefined) data.retentionDays = dto.retentionDays;
    if (dto.labels !== undefined) data.labels = toJsonValue(dto.labels);
    if (dto.metadata !== undefined) data.metadata = toJsonValue(dto.metadata);

    return this.prisma.logStream.update({
      where: { id: stream.id },
      data,
      include: logStreamInclude,
    });
  }
}
