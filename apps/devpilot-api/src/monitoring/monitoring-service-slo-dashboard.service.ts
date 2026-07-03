import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListServiceSloDashboardQueryDto } from "./dto/monitoring.dto";
import { serviceSloDerivedMetrics } from "./monitoring-service-slo.constants";
import { MonitoringServiceSloDashboardBuilderService } from "./monitoring-service-slo-dashboard-builder.service";
import type {
  ServiceSloAlertEvent,
  ServiceSloDashboardRow,
  ServiceSloDeploymentRun,
  ServiceSloOperationRun,
  ServiceSloServiceRecord,
} from "./monitoring-service-slo-dashboard.types";

@Injectable()
export class MonitoringServiceSloDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: MonitoringServiceSloDashboardBuilderService,
  ) {}

  async listRows(teamId: string, query: ListServiceSloDashboardQueryDto) {
    const windowMinutes = this.readPositiveInt(
      query.windowMinutes,
      1440,
      30,
      43200,
    );
    const targetPercent = this.readPercent(query.targetPercent, 99, 50, 99.99);
    const limit = this.readPositiveInt(query.limit, 20, 5, 100);
    const generatedAt = new Date();
    const from = new Date(generatedAt.getTime() - windowMinutes * 60 * 1000);
    const serviceWhere: Prisma.ApplicationServiceWhereInput = {
      teamId,
      status: { not: "archived" },
    };

    if (query.projectId) serviceWhere.projectId = query.projectId;
    if (query.environmentId) serviceWhere.environmentId = query.environmentId;
    if (query.applicationServiceId)
      serviceWhere.id = query.applicationServiceId;

    const services = await this.prisma.applicationService.findMany({
      where: serviceWhere,
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      take: Math.min(limit * 5, 500),
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

    const serviceIds = services.map((service) => service.id);
    if (serviceIds.length === 0) {
      return { generatedAt, windowMinutes, targetPercent, rows: [] };
    }

    const [deploymentRuns, operationRuns, alertEvents] = await Promise.all([
      this.prisma.deploymentRun.findMany({
        where: {
          teamId,
          applicationServiceId: { in: serviceIds },
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
          teamId,
          applicationServiceId: { in: serviceIds },
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
          teamId,
          applicationServiceId: { in: serviceIds },
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

    return {
      generatedAt,
      windowMinutes,
      targetPercent,
      rows: this.buildRows(
        services,
        deploymentRuns,
        operationRuns,
        alertEvents,
        targetPercent,
      ).slice(0, limit),
    };
  }

  buildRows(
    services: ServiceSloServiceRecord[],
    deploymentRuns: ServiceSloDeploymentRun[],
    operationRuns: ServiceSloOperationRun[],
    alertEvents: ServiceSloAlertEvent[],
    targetPercent = 99,
  ) {
    return this.builder.buildRows(
      services,
      deploymentRuns,
      operationRuns,
      alertEvents,
      targetPercent,
    );
  }

  summarize(
    rows: ServiceSloDashboardRow[],
    windowMinutes = 1440,
    targetPercent = 99,
    generatedAt = new Date(),
  ) {
    return this.builder.summarize(
      rows,
      windowMinutes,
      targetPercent,
      generatedAt,
    );
  }

  private readPositiveInt(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(Math.max(Math.floor(numeric), min), max);
  }

  private readPercent(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(Math.max(numeric, min), max);
  }
}
