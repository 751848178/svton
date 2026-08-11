import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { SiteProbeResult } from "../site/site-route-activation.types";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";

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
    const probeHash = promotionProbeHash(input.probe);
    const observedAt = new Date(input.probe.probedAt);
    if (!Number.isFinite(observedAt.getTime())) {
      throw new ConflictException("Production observation 时间无效");
    }
    const updated = await this.prisma.siteRouteSwitchRun.updateMany({
      where: {
        operationId: input.operationId,
        releaseRunId: input.releaseRunId,
        deploymentRunId: input.deploymentRunId,
        status: "switched",
        promotionCandidateHash: null,
        promotionObservedAt: null,
        promotionProbeHash: null,
      },
      data: {
        promotionCandidateHash: input.candidateHash,
        promotionObservedAt: observedAt,
        promotionProbeHash: probeHash,
        promotionObservation: input.probe as unknown as Prisma.InputJsonValue,
      },
    });
    if (updated.count === 1) return { probe: input.probe, probeHash, observedAt };
    return this.loadExact(input);
  }

  async loadExact(input: {
    operationId: string;
    releaseRunId: string;
    deploymentRunId: string;
    candidateHash: string;
  }) {
    const row = await this.prisma.siteRouteSwitchRun.findFirst({
      where: {
        operationId: input.operationId,
        releaseRunId: input.releaseRunId,
        deploymentRunId: input.deploymentRunId,
        promotionCandidateHash: input.candidateHash,
        status: { in: ["switched", "committed"] },
      },
      select: {
        promotionObservedAt: true,
        promotionProbeHash: true,
        promotionObservation: true,
      },
    });
    const probe = siteProbe(row?.promotionObservation);
    if (!row?.promotionObservedAt || !row.promotionProbeHash || !probe ||
      promotionProbeHash(probe) !== row.promotionProbeHash) {
      throw new ConflictException("Production observation 未绑定精确候选或已漂移");
    }
    return {
      probe,
      probeHash: row.promotionProbeHash,
      observedAt: row.promotionObservedAt,
    };
  }
}

export function promotionProbeHash(probe: SiteProbeResult) {
  return hashCanonicalReleaseValue({ version: 1, probe });
}

function siteProbe(value: unknown): SiteProbeResult | null {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
  return row && row.version === 1 && typeof row.probedAt === "string"
    ? row as unknown as SiteProbeResult : null;
}
