import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MonitoringAlertEvaluationResultService } from "./monitoring-alert-evaluation-result.service";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import {
  asRecord,
  readString,
} from "./monitoring-alert-evaluation-value.utils";
import { resourceMetricFields } from "./monitoring-alert-resource-metric-threshold.constants";
import type {
  ResourceMetricField,
  ResourceMetricSample,
  ResourceMetricSnapshotForEvaluation,
} from "./monitoring-alert-resource-metric-threshold.types";
import {
  aggregateMetricValues,
  buildMetricThresholdValue,
  compareMetricValue,
  formatMetricValue,
  metricAggregationLabel,
  metricOperatorLabel,
  normalizeMetricAggregation,
  normalizeMetricOperator,
  readFiniteNumber,
  toMetricSample,
} from "./monitoring-alert-resource-metric-threshold.utils";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import { readPositiveInt } from "./monitoring-number.utils";

@Injectable()
export class MonitoringAlertResourceMetricThresholdEvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly result: MonitoringAlertEvaluationResultService,
  ) {}

  async evaluate(rule: AlertRuleRecord): Promise<AlertEvaluationResult> {
    const condition = asRecord(rule.condition);
    const metricName = readString(condition.metricName) || "cpuPercent";
    const metricField = resourceMetricFields[metricName];
    if (!metricField) {
      return this.result.insufficient(
        rule,
        `不支持的资源指标字段: ${metricName}`,
        { metricName, supportedMetrics: Object.keys(resourceMetricFields) },
      );
    }

    const threshold = readFiniteNumber(condition.threshold);
    if (threshold === undefined) {
      return this.result.insufficient(rule, "资源指标阈值规则缺少 threshold", {
        metricName,
        supportedMetrics: Object.keys(resourceMetricFields),
      });
    }

    const windowMinutes = readPositiveInt(
      condition.windowMinutes,
      60,
      1,
      10080,
    );
    const aggregation = normalizeMetricAggregation(condition.aggregation);
    const operator = normalizeMetricOperator(condition.operator);
    const metricSource = readString(condition.metricSource) || "docker_stats";
    const to = new Date();
    const from = new Date(to.getTime() - windowMinutes * 60 * 1000);
    const snapshots = await this.readSnapshots(
      rule,
      metricField,
      metricSource,
      from,
      to,
    );
    const samples = snapshots
      .map((snapshot) =>
        toMetricSample(
          snapshot as ResourceMetricSnapshotForEvaluation,
          metricField,
        ),
      )
      .filter((sample): sample is ResourceMetricSample => Boolean(sample));

    if (!samples.length) {
      return this.result.insufficient(
        rule,
        `最近 ${windowMinutes} 分钟没有可评估的${metricField.label}指标快照`,
        {
          metricName,
          metricLabel: metricField.label,
          metricSource,
          windowMinutes,
          from,
          to,
          threshold,
          operator,
          aggregation,
        },
      );
    }

    const evaluatedValue = aggregateMetricValues(
      samples.map((sample) => sample.value),
      aggregation,
    );
    const firing = compareMetricValue(evaluatedValue, threshold, operator);
    const value = buildMetricThresholdValue({
      metricName,
      metricField,
      metricSource,
      windowMinutes,
      from,
      to,
      aggregation,
      operator,
      threshold,
      evaluatedValue,
      resourceId: rule.managedResourceId || null,
      samples,
    });
    const formattedValue = formatMetricValue(evaluatedValue, metricField.unit);
    const formattedThreshold = formatMetricValue(threshold, metricField.unit);
    const operatorLabel = metricOperatorLabel(operator);
    const aggregationLabel = metricAggregationLabel(aggregation);

    if (firing) {
      return this.result.firing(
        rule,
        `最近 ${windowMinutes} 分钟${metricField.label}${aggregationLabel} ${formattedValue} ${operatorLabel} ${formattedThreshold}`,
        value,
      );
    }

    return this.result.ok(
      rule,
      `最近 ${windowMinutes} 分钟${metricField.label}${aggregationLabel} ${formattedValue} 未达到阈值 ${operatorLabel} ${formattedThreshold}`,
      value,
    );
  }

  private readSnapshots(
    rule: AlertRuleRecord,
    metricField: ResourceMetricField,
    metricSource: string,
    from: Date,
    to: Date,
  ) {
    const where: Prisma.ResourceMetricSnapshotWhereInput = {
      teamId: rule.teamId,
      resourceId: rule.managedResourceId ?? undefined,
      projectId: rule.projectId ?? undefined,
      environmentId: rule.environmentId ?? undefined,
      metricSource,
      sampledAt: { gte: from, lte: to },
    };
    (where as Record<string, unknown>)[metricField.key] = { not: null };

    return this.prisma.resourceMetricSnapshot.findMany({
      where,
      orderBy: { sampledAt: "desc" },
      take: 500,
      select: {
        id: true,
        resourceId: true,
        sampledAt: true,
        status: true,
        metricSource: true,
        cpuPercent: true,
        memoryPercent: true,
        memoryUsageBytes: true,
        networkInputBytes: true,
        networkOutputBytes: true,
        blockInputBytes: true,
        blockOutputBytes: true,
        pids: true,
        resource: {
          select: {
            id: true,
            name: true,
            provider: true,
            kind: true,
            sourceType: true,
          },
        },
      },
    });
  }
}
