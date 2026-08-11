import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  SiteRouteSwitchAttemptPersistence,
  SiteRouteSwitchInput,
  SiteRouteSwitchReceipt,
} from "./site-route-switch.types";

@Injectable()
export class SiteRouteSwitchSagaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async prepare(input: SiteRouteSwitchInput, providerKey: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ProjectEnvironment
        WHERE id = ${input.environmentId}
          AND teamId = ${input.teamId}
          AND projectId = ${input.projectId}
        FOR UPDATE`;
      await tx.site.findFirstOrThrow({
        where: {
          id: input.siteId,
          teamId: input.teamId,
          projectId: input.projectId,
          environmentId: input.environmentId,
        },
        select: { id: true },
      });
      return tx.siteRouteSwitchRun.upsert({
        where: { operationId: input.operationId },
        create: {
          operationId: input.operationId,
          providerKey,
          teamId: input.teamId,
          siteId: input.siteId,
          projectId: input.projectId,
          environmentId: input.environmentId,
          deploymentRunId: input.deploymentRunId,
          releaseRunId: input.releaseRunId,
          targetRef: input.targetRef,
          proxyTarget: input.proxyTarget,
          domains: input.domains,
          desiredRoute: json(input),
          previousRoute: Prisma.JsonNull,
          status: "prepared",
        },
        update: {},
      });
    });
  }

  async freezePrevious(
    operationId: string,
    desired: SiteRouteSwitchInput,
    previous: SiteRouteSwitchInput | null,
  ) {
    const result = await this.prisma.siteRouteSwitchRun.updateMany({
      where: { operationId, status: "prepared" },
      data: {
        desiredRoute: json(desired),
        previousRoute: previous ? json(previous) : Prisma.JsonNull,
      },
    });
    return result.count === 1;
  }

  get(operationId: string) {
    return this.prisma.siteRouteSwitchRun.findUnique({
      where: { operationId },
    });
  }

  async markApplying(operationId: string) {
    return this.transition(operationId, ["prepared"], "applying", {
      attemptCount: { increment: 1 },
      lastError: null,
    });
  }

  async markSwitched(operationId: string, receipt: SiteRouteSwitchReceipt) {
    return this.transition(operationId, ["applying"], "switched", {
      applyReceipt: json(receipt),
      reasonCode: receipt.reasonCode,
    });
  }

  async claimCompensation(operationId: string, compensationId: string) {
    const result = await this.prisma.siteRouteSwitchRun.updateMany({
      where: {
        operationId,
        status: { in: ["applying", "switched", "compensation_required"] },
      },
      data: {
        status: "compensating",
        compensationOperationId: compensationId,
        attemptCount: { increment: 1 },
      },
    });
    return result.count === 1;
  }

  markCompensated(operationId: string, receipt: SiteRouteSwitchReceipt) {
    return this.transition(operationId, ["compensating"], "compensated", {
      compensationReceipt: json(receipt),
      lastError: null,
      finishedAt: new Date(),
    });
  }

  requireCompensation(operationId: string, error: string) {
    return this.transition(
      operationId,
      ["compensating"],
      "compensation_required",
      {
        lastError: error,
      },
    );
  }

  markFailed(operationId: string, error: string) {
    return this.transition(
      operationId,
      ["prepared", "applying", "compensated"],
      "failed",
      {
        lastError: error,
        finishedAt: new Date(),
      },
    );
  }

  async commit(
    tx: Prisma.TransactionClient,
    operationId: string,
    attempt: SiteRouteSwitchAttemptPersistence,
  ) {
    const committed = await tx.siteRouteSwitchRun.updateMany({
      where: { operationId, status: "switched" },
      data: {
        status: "committed",
        result: json({ siteProbe: attempt.siteProbe ?? null }),
        finishedAt: new Date(),
      },
    });
    if (committed.count !== 1)
      throw new Error("SITE_ROUTE_SAGA_COMMIT_CONFLICT");
    const current = await tx.site.findUniqueOrThrow({
      where: { id: attempt.evidence.siteId },
      select: { tls: true },
    });
    const updated = await tx.site.updateMany({
      where: {
        id: attempt.evidence.siteId,
        teamId: attempt.evidence.teamId,
        projectId: attempt.evidence.projectId,
        environmentId: attempt.evidence.environmentId,
      },
      data: {
        routeSwitch: json(attempt.evidence),
        dns: json(attempt.dnsProbe ?? {}),
        tls: json({ ...record(current.tls), probe: attempt.tlsProbe ?? null }),
      },
    });
    if (updated.count !== 1) throw new Error("SITE_ROUTE_SWITCH_CONFLICT");
  }

  private async transition(
    operationId: string,
    from: string[],
    status: string,
    data: Prisma.SiteRouteSwitchRunUpdateManyMutationInput,
  ) {
    const result = await this.prisma.siteRouteSwitchRun.updateMany({
      where: { operationId, status: { in: from } },
      data: { ...data, status },
    });
    return result.count === 1;
  }
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
