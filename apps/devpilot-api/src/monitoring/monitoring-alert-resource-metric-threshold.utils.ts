import { readString } from "./monitoring-alert-evaluation-value.utils";
import type {
  ResourceMetricField,
  ResourceMetricSample,
  ResourceMetricSnapshotForEvaluation,
  ResourceMetricThresholdValueInput,
} from "./monitoring-alert-resource-metric-threshold.types";

export function readFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}

export function normalizeMetricAggregation(value: unknown) {
  const aggregation = readString(value);
  return aggregation && ["latest", "average", "max"].includes(aggregation)
    ? aggregation
    : "latest";
}

export function normalizeMetricOperator(value: unknown) {
  const operator = readString(value);
  return operator && ["gte", "gt", "lte", "lt"].includes(operator)
    ? operator
    : "gte";
}

export function aggregateMetricValues(values: number[], aggregation: string) {
  if (aggregation === "average") {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  if (aggregation === "max") {
    return Math.max(...values);
  }
  return values[0];
}

export function compareMetricValue(
  value: number,
  threshold: number,
  operator: string,
) {
  if (operator === "gt") return value > threshold;
  if (operator === "lte") return value <= threshold;
  if (operator === "lt") return value < threshold;
  return value >= threshold;
}

export function metricAggregationLabel(aggregation: string) {
  if (aggregation === "average") return "平均值";
  if (aggregation === "max") return "峰值";
  return "当前值";
}

export function metricOperatorLabel(operator: string) {
  const labels: Record<string, string> = {
    gte: ">=",
    gt: ">",
    lte: "<=",
    lt: "<",
  };
  return labels[operator] || ">=";
}

export function formatMetricValue(
  value: number,
  unit: ResourceMetricField["unit"],
) {
  if (unit === "percent") {
    return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
  }
  if (unit === "bytes") {
    return `${Math.round(value)}B`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function toMetricSample(
  snapshot: ResourceMetricSnapshotForEvaluation,
  metricField: ResourceMetricField,
): ResourceMetricSample | null {
  const value = readFiniteNumber(snapshot[metricField.key]);
  if (value === undefined) return null;
  return {
    id: snapshot.id,
    resourceId: snapshot.resourceId,
    resourceName: snapshot.resource?.name || snapshot.resourceId,
    sampledAt: snapshot.sampledAt,
    status: snapshot.status,
    value,
  };
}

export function buildMetricThresholdValue(
  input: ResourceMetricThresholdValueInput,
) {
  const latestSample = input.samples[0];
  return {
    metricName: input.metricName,
    metricLabel: input.metricField.label,
    metricSource: input.metricSource,
    unit: input.metricField.unit,
    windowMinutes: input.windowMinutes,
    from: input.from,
    to: input.to,
    aggregation: input.aggregation,
    operator: input.operator,
    threshold: input.threshold,
    value: input.evaluatedValue,
    sampleCount: input.samples.length,
    resourceId: input.resourceId,
    latestSample,
    recentSamples: input.samples.slice(0, 5).map((sample) => ({
      id: sample.id,
      resourceId: sample.resourceId,
      resourceName: sample.resourceName,
      sampledAt: sample.sampledAt,
      value: sample.value,
    })),
  };
}
