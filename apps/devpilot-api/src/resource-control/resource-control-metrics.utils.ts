/**
 * Pure metric-trend helpers for the resource-control feature.
 *
 * Extracted verbatim from `ResourceControlService` private methods so the
 * metrics read service and the facade share one implementation. Stateless —
 * no service / DB dependencies. No behavior change.
 */

export const RESOURCE_METRIC_SERIES_FIELDS = [
  'cpuPercent',
  'memoryPercent',
  'memoryUsageBytes',
  'networkInputBytes',
  'networkOutputBytes',
  'blockInputBytes',
  'blockOutputBytes',
  'pids',
] as const;

export type ResourceMetricSeriesMetric = (typeof RESOURCE_METRIC_SERIES_FIELDS)[number];

export interface MetricTrendNumberSummary {
  latest: number | null;
  average: number | null;
  max: number | null;
  delta: number | null;
}

export interface ResourceMetricSnapshotForTrend {
  id: string;
  resourceId: string;
  projectId: string | null;
  environmentId: string | null;
  sourceType: string;
  provider: string;
  kind: string;
  metricSource: string;
  status: string;
  sampledAt: Date;
  cpuPercent: number | null;
  memoryUsageBytes: number | null;
  memoryLimitBytes: number | null;
  memoryPercent: number | null;
  networkInputBytes: number | null;
  networkOutputBytes: number | null;
  blockInputBytes: number | null;
  blockOutputBytes: number | null;
  pids: number | null;
  resource?: MetricTrendResourceRef | null;
}

export interface MetricTrendResourceRef {
  id: string;
  projectId: string | null;
  environmentId: string | null;
  name: string;
  provider: string;
  kind: string;
  sourceType: string;
  endpoint: string | null;
}

export function parseMetricTrendWindowMinutes(value?: string) {
  const minutes = Number(value || '60');
  if (!Number.isFinite(minutes)) {
    return 60;
  }
  return Math.min(Math.max(Math.trunc(minutes), 5), 10080);
}

export function parseMetricSeriesLimit(value?: string) {
  const limit = Number(value || '120');
  if (!Number.isFinite(limit)) {
    return 120;
  }
  return Math.min(Math.max(Math.trunc(limit), 10), 1000);
}

export function parseMetricSeriesMetric(value?: string): ResourceMetricSeriesMetric {
  if (RESOURCE_METRIC_SERIES_FIELDS.includes(value as ResourceMetricSeriesMetric)) {
    return value as ResourceMetricSeriesMetric;
  }
  return 'cpuPercent';
}

export function metricSeriesValue(snapshot: ResourceMetricSnapshotForTrend, metric: ResourceMetricSeriesMetric) {
  const value = snapshot[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function summarizeMetricNumber(values: Array<number | null>): MetricTrendNumberSummary {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
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
