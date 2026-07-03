import { Injectable } from "@nestjs/common";
import type {
  ResourceMetricDashboardRow,
  ResourceMetricDashboardSnapshot,
  ResourceMetricDashboardValue,
} from "./monitoring-resource-metric-dashboard.types";

@Injectable()
export class MonitoringResourceMetricDashboardBuilderService {
  buildRows(
    snapshots: ResourceMetricDashboardSnapshot[],
    staleAfterMinutes = 180,
  ): ResourceMetricDashboardRow[] {
    const groups = new Map<string, ResourceMetricDashboardSnapshot[]>();
    for (const snapshot of snapshots) {
      groups.set(snapshot.resourceId, [
        ...(groups.get(snapshot.resourceId) || []),
        snapshot,
      ]);
    }

    return Array.from(groups.values())
      .map((group) => this.buildRow(group, staleAfterMinutes))
      .sort((left, right) => this.compareRows(left, right));
  }

  summarize(
    rows: ResourceMetricDashboardRow[],
    windowMinutes = 360,
    staleAfterMinutes = 180,
    generatedAt = new Date(),
  ) {
    return {
      generatedAt,
      windowMinutes,
      staleAfterMinutes,
      resourceCount: rows.length,
      sampleCount: rows.reduce((sum, row) => sum + row.sampleCount, 0),
      okCount: rows.filter((row) => row.status === "ok").length,
      warningCount: rows.filter((row) => row.status === "warning").length,
      criticalCount: rows.filter((row) => row.status === "critical").length,
      staleCount: rows.filter((row) => row.status === "stale").length,
      maxCpuPercent: this.maxMetric(rows.map((row) => row.cpuPercent.max)),
      maxMemoryPercent: this.maxMetric(
        rows.map((row) => row.memoryPercent.max),
      ),
      maxPids: this.maxMetric(rows.map((row) => row.pids.max)),
      rows,
    };
  }

  private buildRow(
    group: ResourceMetricDashboardSnapshot[],
    staleAfterMinutes: number,
  ): ResourceMetricDashboardRow {
    const ordered = [...group].sort(
      (left, right) => right.sampledAt.getTime() - left.sampledAt.getTime(),
    );
    const latest = ordered[0];
    const oldest = ordered[ordered.length - 1];
    const minutesSinceLastSample = Math.max(
      0,
      Math.floor((Date.now() - latest.sampledAt.getTime()) / (60 * 1000)),
    );
    const row = {
      id: latest.resourceId,
      resourceId: latest.resourceId,
      projectId: latest.projectId,
      environmentId: latest.environmentId,
      sourceType: latest.sourceType,
      provider: latest.provider,
      kind: latest.kind,
      metricSource: latest.metricSource,
      sampleCount: ordered.length,
      firstSampledAt: oldest.sampledAt,
      lastSampledAt: latest.sampledAt,
      minutesSinceLastSample,
      resource: latest.resource,
      cpuPercent: this.summarizeMetric(ordered.map((item) => item.cpuPercent)),
      memoryPercent: this.summarizeMetric(
        ordered.map((item) => item.memoryPercent),
      ),
      memoryUsageBytes: this.summarizeMetric(
        ordered.map((item) => item.memoryUsageBytes),
      ),
      networkInputBytes: this.summarizeMetric(
        ordered.map((item) => item.networkInputBytes),
      ),
      networkOutputBytes: this.summarizeMetric(
        ordered.map((item) => item.networkOutputBytes),
      ),
      blockInputBytes: this.summarizeMetric(
        ordered.map((item) => item.blockInputBytes),
      ),
      blockOutputBytes: this.summarizeMetric(
        ordered.map((item) => item.blockOutputBytes),
      ),
      pids: this.summarizeMetric(ordered.map((item) => item.pids)),
    };
    const status = this.rowStatus(row, staleAfterMinutes);
    return { ...row, status: status.status, statusReason: status.reason };
  }

  private compareRows(
    left: ResourceMetricDashboardRow,
    right: ResourceMetricDashboardRow,
  ) {
    return (
      this.statusRank(right.status) - this.statusRank(left.status) ||
      (right.cpuPercent.max ?? -1) - (left.cpuPercent.max ?? -1) ||
      (right.memoryPercent.max ?? -1) - (left.memoryPercent.max ?? -1) ||
      right.lastSampledAt.getTime() - left.lastSampledAt.getTime()
    );
  }

  private summarizeMetric(
    values: Array<number | null>,
  ): ResourceMetricDashboardValue {
    const numbers = values.filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
    if (numbers.length === 0) {
      return { latest: null, average: null, max: null, delta: null };
    }

    const latest = numbers[0];
    const oldest = numbers[numbers.length - 1];
    return {
      latest,
      average: numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
      max: Math.max(...numbers),
      delta: latest - oldest,
    };
  }

  private maxMetric(values: Array<number | null>) {
    const numbers = values.filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
    return numbers.length > 0 ? Math.max(...numbers) : null;
  }

  private rowStatus(
    row: Pick<
      ResourceMetricDashboardRow,
      "cpuPercent" | "memoryPercent" | "minutesSinceLastSample"
    >,
    staleAfterMinutes: number,
  ): { status: ResourceMetricDashboardRow["status"]; reason: string } {
    if (row.minutesSinceLastSample > staleAfterMinutes) {
      return {
        status: "stale",
        reason: `最近 ${row.minutesSinceLastSample} 分钟没有新样本`,
      };
    }
    if (
      (row.cpuPercent.latest ?? 0) >= 90 ||
      (row.memoryPercent.latest ?? 0) >= 90
    ) {
      return { status: "critical", reason: "CPU 或内存当前值达到严重阈值" };
    }
    if (
      (row.cpuPercent.latest ?? 0) >= 75 ||
      (row.memoryPercent.latest ?? 0) >= 80
    ) {
      return { status: "warning", reason: "CPU 或内存当前值达到预警阈值" };
    }
    return { status: "ok", reason: "最近资源指标正常" };
  }

  private statusRank(status: ResourceMetricDashboardRow["status"]) {
    const ranks: Record<ResourceMetricDashboardRow["status"], number> = {
      critical: 4,
      warning: 3,
      stale: 2,
      ok: 1,
    };
    return ranks[status] || 0;
  }
}
