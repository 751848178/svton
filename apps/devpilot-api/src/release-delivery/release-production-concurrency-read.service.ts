import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ACTIVE_RELEASE_RUN_STATUSES } from "./release-run-concurrency.utils";

@Injectable()
export class ReleaseProductionConcurrencyReadService {
  constructor(private readonly prisma: PrismaService) {}

  async inspect(input: {
    teamId: string;
    projectId: string;
    environmentId: string;
  }) {
    const active = await this.prisma.releaseRun.findFirst({
      where: {
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        status: { in: [...ACTIVE_RELEASE_RUN_STATUSES] },
      },
      select: {
        id: true,
        releaseOrderId: true,
        mode: true,
        status: true,
        createdAt: true,
        releaseOrder: { select: { releaseVersion: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return {
      limit: 1 as const,
      state: active ? ("occupied" as const) : ("available" as const),
      checkedAt: new Date().toISOString(),
      activeRun: active
        ? {
            id: active.id,
            releaseOrderId: active.releaseOrderId,
            releaseVersion: active.releaseOrder.releaseVersion,
            mode: active.mode,
            status: active.status,
            createdAt: active.createdAt,
          }
        : null,
    };
  }
}
