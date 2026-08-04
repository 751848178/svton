import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { releaseOrderLifecycleDetailQuery } from "./release-order-lifecycle.query";
import {
  presentReleaseOrderLifecycle,
  presentReleaseOrderResumeStep,
} from "./release-order-lifecycle.presenter";
import type { ReleaseOrderLifecycleRow } from "./release-order-lifecycle.types";

type ReleaseOrderDetailLifecycleRow = ReleaseOrderLifecycleRow & {
  resumeStep: string | null;
};

const detailInclude = {
  _count: { select: { buildRuns: true, manifests: true, releaseRuns: true } },
  project: {
    select: {
      repositoryConnection: {
        select: {
          repositoryUrl: true,
          provider: true,
          status: true,
          defaultBranch: true,
          selectedBranch: true,
        },
      },
      repositoryIdentity: {
        select: {
          id: true,
          projectId: true,
          provider: true,
          canonicalKey: true,
          canonicalUrl: true,
          lockedAt: true,
          currentRevision: {
            select: {
              id: true,
              revision: true,
              defaultBranch: true,
              reason: true,
              createdAt: true,
              identityId: true,
              projectId: true,
            },
          },
        },
      },
      environments: {
        where: {
          status: "active",
          baselineRole: { in: ["staging", "production"] as string[] },
        },
        select: { id: true, baselineRole: true },
      },
    },
  },
} as const;

@Injectable()
export class ReleaseOrderDetailRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(teamId: string, projectId: string, releaseOrderId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.releaseOrder.findFirst({
          where: { id: releaseOrderId, teamId, projectId },
          include: detailInclude,
        });
        if (!order) return null;
        const rows = await tx.$queryRaw<ReleaseOrderDetailLifecycleRow[]>(
          releaseOrderLifecycleDetailQuery({
            teamId,
            projectId,
            releaseOrderId,
          }),
        );
        if (!rows[0]) return null;
        return {
          order,
          ...presentReleaseOrderLifecycle(rows[0]),
          resumeStep: presentReleaseOrderResumeStep(rows[0].resumeStep),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
