import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import type { ServiceSloWindowSignals } from "./monitoring-alert-service-slo-window.types";
import { serviceSloDerivedMetrics } from "./monitoring-service-slo.constants";

@Injectable()
export class MonitoringAlertServiceSloSignalService {
  constructor(private readonly prisma: PrismaService) {}

  async loadSignals(
    rule: AlertRuleRecord,
    from: Date,
    generatedAt: Date,
  ): Promise<ServiceSloWindowSignals | null> {
    if (!rule.applicationServiceId) {
      return null;
    }

    const service = await this.prisma.applicationService.findFirst({
      where: {
        id: rule.applicationServiceId,
        teamId: rule.teamId,
      },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        name: true,
        kind: true,
        status: true,
        runtime: true,
        project: { select: { id: true, name: true } },
        environment: {
          select: { id: true, key: true, name: true, status: true },
        },
        application: { select: { id: true, name: true, status: true } },
      },
    });

    if (!service) {
      return null;
    }

    const [deploymentRuns, operationRuns, alertEvents] = await Promise.all([
      this.prisma.deploymentRun.findMany({
        where: {
          teamId: rule.teamId,
          applicationServiceId: service.id,
          dryRun: false,
          startedAt: { gte: from, lte: generatedAt },
        },
        select: {
          id: true,
          applicationServiceId: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          error: true,
        },
      }),
      this.prisma.applicationServiceOperationRun.findMany({
        where: {
          teamId: rule.teamId,
          applicationServiceId: service.id,
          dryRun: false,
          startedAt: { gte: from, lte: generatedAt },
        },
        select: {
          id: true,
          applicationServiceId: true,
          action: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          error: true,
        },
      }),
      this.prisma.alertEvent.findMany({
        where: {
          teamId: rule.teamId,
          applicationServiceId: service.id,
          occurredAt: { gte: from, lte: generatedAt },
          status: { in: ["firing", "error", "suppressed"] },
          metric: { notIn: serviceSloDerivedMetrics },
        },
        select: {
          id: true,
          applicationServiceId: true,
          severity: true,
          status: true,
          occurredAt: true,
        },
      }),
    ]);

    return { service, deploymentRuns, operationRuns, alertEvents };
  }
}
