/**
 * ReleaseEvent 仓储：只追加时间线。metadata 在写入前由调用方脱敏。
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface AppendReleaseEventInput {
  releasePlanId: string;
  releaseStageId?: string | null;
  stageAttemptId?: string | null;
  teamId: string;
  eventType: string;
  actorType?: string;
  actorId?: string | null;
  correlationId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class ReleaseEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: AppendReleaseEventInput) {
    return this.prisma.releaseEvent.create({
      data: {
        releasePlanId: input.releasePlanId,
        releaseStageId: input.releaseStageId ?? null,
        stageAttemptId: input.stageAttemptId ?? null,
        teamId: input.teamId,
        eventType: input.eventType,
        actorType: input.actorType ?? "system",
        actorId: input.actorId ?? null,
        correlationId: input.correlationId ?? null,
        summary: input.summary ?? null,
        metadata: (input.metadata ?? null) as never,
      },
    });
  }

  async listByPlan(releasePlanId: string, take = 100) {
    return this.prisma.releaseEvent.findMany({
      where: { releasePlanId },
      orderBy: { createdAt: "desc" },
      take: Math.min(take, 200),
    });
  }
}
