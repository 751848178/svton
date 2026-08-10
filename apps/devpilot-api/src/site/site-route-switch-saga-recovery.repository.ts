import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ACTIVE_ROUTE_SAGA_STATUSES } from "./production-route-saga.guard";

export const ROUTE_SAGA_MAX_RECOVERY_ATTEMPTS = 8;

@Injectable()
export class SiteRouteSwitchSagaRecoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  due(now: Date, staleBefore: Date) {
    return this.prisma.siteRouteSwitchRun.findMany({
      where: {
        status: { in: [...ACTIVE_ROUTE_SAGA_STATUSES] },
        recoveryAttemptCount: { lt: ROUTE_SAGA_MAX_RECOVERY_ATTEMPTS },
        updatedAt: { lt: staleBefore },
        OR: [{ nextRecoveryAt: null }, { nextRecoveryAt: { lte: now } }],
        AND: [
          {
            OR: [
              { recoveryLeaseUntil: null },
              { recoveryLeaseUntil: { lt: now } },
            ],
          },
        ],
      },
      orderBy: [{ nextRecoveryAt: "asc" }, { updatedAt: "asc" }],
      take: 50,
    });
  }

  async claim(operationId: string, leaseId: string, now: Date) {
    const leaseUntil = new Date(now.getTime() + 30_000);
    const result = await this.prisma.siteRouteSwitchRun.updateMany({
      where: {
        operationId,
        status: { in: [...ACTIVE_ROUTE_SAGA_STATUSES] },
        recoveryAttemptCount: { lt: ROUTE_SAGA_MAX_RECOVERY_ATTEMPTS },
        OR: [{ recoveryLeaseUntil: null }, { recoveryLeaseUntil: { lt: now } }],
      },
      data: {
        recoveryLeaseId: leaseId,
        recoveryLeaseUntil: leaseUntil,
        recoveryAttemptCount: { increment: 1 },
      },
    });
    return result.count === 1;
  }

  async release(
    operationId: string,
    leaseId: string,
    nextRecoveryAt: Date | null,
  ) {
    const result = await this.prisma.siteRouteSwitchRun.updateMany({
      where: { operationId, recoveryLeaseId: leaseId },
      data: {
        recoveryLeaseId: null,
        recoveryLeaseUntil: null,
        nextRecoveryAt,
      },
    });
    return result.count === 1;
  }

  requeueStaleCompensation(operationId: string, leaseId: string) {
    return this.prisma.siteRouteSwitchRun.updateMany({
      where: { operationId, status: "compensating", recoveryLeaseId: leaseId },
      data: { status: "compensation_required" },
    });
  }

  async alertExhausted(now: Date) {
    const exhausted = await this.prisma.siteRouteSwitchRun.findMany({
      where: {
        status: { in: [...ACTIVE_ROUTE_SAGA_STATUSES] },
        recoveryAttemptCount: { gte: ROUTE_SAGA_MAX_RECOVERY_ATTEMPTS },
        alertedAt: null,
      },
      select: {
        id: true,
        operationId: true,
        status: true,
        lastError: true,
        updatedAt: true,
        teamId: true,
        projectId: true,
        environmentId: true,
        siteId: true,
        deploymentRunId: true,
      },
      take: 100,
    });
    const alerted = [];
    for (const item of exhausted) {
      const claimed = await this.prisma.siteRouteSwitchRun.updateMany({
        where: {
          id: item.id,
          status: item.status,
          recoveryAttemptCount: { gte: ROUTE_SAGA_MAX_RECOVERY_ATTEMPTS },
          alertedAt: null,
          updatedAt: item.updatedAt,
        },
        data: { alertedAt: now },
      });
      if (claimed.count === 1) alerted.push(item);
    }
    return alerted;
  }
}
