import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListResourceProvisioningRunsQueryDto } from './dto/resource-request.dto';
import { JsonRecord } from './resource-provisioning-run.types';

type PrismaAny = {
  resourceRequest: { findFirst: (args: unknown) => Promise<unknown> };
  resourceProvisioningRun: { findMany: (args: unknown) => Promise<unknown[]> };
};

/**
 * Read-only provisioning-run list/query boundary. Owns the team/request-scoped
 * run listing; the host executor supplies `serializeProvisioningRun` so the
 * response shape stays unchanged.
 */
@Injectable()
export class ResourceProvisioningRunReadService {
  constructor(private readonly prisma: PrismaService) {}

  async listRuns(
    teamId: string,
    requestId: string,
    query: ListResourceProvisioningRunsQueryDto,
    serializeProvisioningRun: (run: JsonRecord) => unknown,
  ) {
    const request = await this.raw().resourceRequest.findFirst({
      where: { id: requestId, teamId },
      select: { id: true },
    });
    if (!request) {
      throw new NotFoundException('资源申请不存在');
    }

    const where: Record<string, unknown> = { teamId, requestId };
    if (query.status) where.status = query.status;
    if (query.mode) where.mode = query.mode;
    if (query.trigger) where.trigger = query.trigger;

    const runs = await this.raw().resourceProvisioningRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: this.readListLimit(query.limit, 20, 100),
      include: {
        actor: { select: { id: true, name: true, email: true } },
        resourceType: { select: { id: true, key: true, name: true } },
        replayOf: {
          select: {
            id: true,
            status: true,
            trigger: true,
            providerRunId: true,
            startedAt: true,
          },
        },
        _count: { select: { replayAttempts: true } },
      },
    });

    return (runs as JsonRecord[]).map((run) => serializeProvisioningRun(run));
  }

  private raw(): PrismaAny {
    return this.prisma as unknown as PrismaAny;
  }

  private readListLimit(value: unknown, fallback: number, max: number) {
    const parsed =
      typeof value === 'number'
        ? value
        : Number.parseInt(typeof value === 'string' ? value : '', 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
  }
}
