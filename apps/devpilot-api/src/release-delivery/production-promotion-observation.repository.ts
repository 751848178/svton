import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { SiteProbeResult } from "../site/site-route-activation.types";

@Injectable()
export class ProductionPromotionObservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    operationId: string;
    releaseRunId: string;
    deploymentRunId: string;
    candidateHash: string;
    probe: SiteProbeResult;
  }) {
    const updated = await this.prisma.siteRouteSwitchRun.updateMany({
      where: {
        operationId: input.operationId,
        releaseRunId: input.releaseRunId,
        deploymentRunId: input.deploymentRunId,
        status: "switched",
      },
      data: {
        result: {
          version: 1,
          candidateHash: input.candidateHash,
          siteProbe: input.probe,
          observedAt: input.probe.probedAt,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException("Production route observation 无法绑定精确候选");
    }
  }
}
