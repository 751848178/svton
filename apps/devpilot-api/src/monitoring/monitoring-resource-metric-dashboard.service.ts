import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListResourceMetricDashboardQueryDto } from "./dto/monitoring.dto";
import { MonitoringResourceMetricDashboardBuilderService } from "./monitoring-resource-metric-dashboard-builder.service";
import type {
  ResourceMetricDashboardRow,
  ResourceMetricDashboardSnapshot,
} from "./monitoring-resource-metric-dashboard.types";

@Injectable()
export class MonitoringResourceMetricDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: MonitoringResourceMetricDashboardBuilderService,
  ) {}

  async listRows(teamId: string, query: ListResourceMetricDashboardQueryDto) {
    const windowMinutes = this.readPositiveInt(
      query.windowMinutes,
      360,
      5,
      10080,
    );
    const staleAfterMinutes = this.readPositiveInt(
      query.staleAfterMinutes,
      Math.min(Math.max(Math.floor(windowMinutes / 2), 15), 360),
      5,
      10080,
    );
    const limit = this.readPositiveInt(query.limit, 30, 5, 100);
    const metricSource = this.readString(query.metricSource) || "docker_stats";
    const to = new Date();
    const from = new Date(to.getTime() - windowMinutes * 60 * 1000);
    const where: Prisma.ResourceMetricSnapshotWhereInput = {
      teamId,
      metricSource,
      sampledAt: { gte: from, lte: to },
    };

    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;

    const snapshots = await this.prisma.resourceMetricSnapshot.findMany({
      where,
      orderBy: { sampledAt: "desc" },
      take: Math.min(limit * 50, 5000),
      select: {
        id: true,
        resourceId: true,
        projectId: true,
        environmentId: true,
        sourceType: true,
        provider: true,
        kind: true,
        metricSource: true,
        status: true,
        sampledAt: true,
        cpuPercent: true,
        memoryUsageBytes: true,
        memoryLimitBytes: true,
        memoryPercent: true,
        networkInputBytes: true,
        networkOutputBytes: true,
        blockInputBytes: true,
        blockOutputBytes: true,
        pids: true,
        resource: {
          select: {
            id: true,
            name: true,
            sourceType: true,
            provider: true,
            kind: true,
            status: true,
            endpoint: true,
            project: { select: { id: true, name: true } },
            environment: {
              select: { id: true, key: true, name: true, status: true },
            },
          },
        },
      },
    });

    return {
      generatedAt: to,
      windowMinutes,
      staleAfterMinutes,
      rows: this.buildRows(snapshots, staleAfterMinutes).slice(0, limit),
    };
  }

  buildRows(
    snapshots: ResourceMetricDashboardSnapshot[],
    staleAfterMinutes = 180,
  ) {
    return this.builder.buildRows(snapshots, staleAfterMinutes);
  }

  summarize(
    rows: ResourceMetricDashboardRow[],
    windowMinutes = 360,
    staleAfterMinutes = 180,
    generatedAt = new Date(),
  ) {
    return this.builder.summarize(
      rows,
      windowMinutes,
      staleAfterMinutes,
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

  private readString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : null;
  }
}
