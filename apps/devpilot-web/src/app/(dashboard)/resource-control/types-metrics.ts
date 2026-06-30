/** 资源管控域类型 - 指标/趋势/序列接口。 */

export interface ResourceMetricSnapshot {
  id: string;
  resourceId: string;
  resourceActionRunId?: string | null;
  sourceType: string;
  provider: string;
  kind: string;
  metricSource: string;
  status: 'collected' | 'partial';
  sampledAt: string;
  cpuPercent?: number | null;
  memoryUsageBytes?: number | null;
  memoryLimitBytes?: number | null;
  memoryPercent?: number | null;
  networkInputBytes?: number | null;
  networkOutputBytes?: number | null;
  blockInputBytes?: number | null;
  blockOutputBytes?: number | null;
  pids?: number | null;
  resource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    sourceType: string;
    endpoint?: string | null;
  } | null;
  resourceActionRun?: {
    id: string;
    action: string;
    status: string;
    dryRun: boolean;
    startedAt: string;
    finishedAt?: string | null;
  } | null;
}

export interface ResourceMetricTrendValue {
  latest: number | null;
  average: number | null;
  max: number | null;
  delta: number | null;
}

export interface ResourceMetricTrendSummary {
  id: string;
  resourceId: string;
  sourceType: string;
  provider: string;
  kind: string;
  metricSource: string;
  windowMinutes: number;
  sampleCount: number;
  firstSampledAt: string;
  lastSampledAt: string;
  cpuPercent: ResourceMetricTrendValue;
  memoryPercent: ResourceMetricTrendValue;
  memoryUsageBytes: ResourceMetricTrendValue;
  networkInputBytes: ResourceMetricTrendValue;
  networkOutputBytes: ResourceMetricTrendValue;
  blockInputBytes: ResourceMetricTrendValue;
  blockOutputBytes: ResourceMetricTrendValue;
  pids: ResourceMetricTrendValue;
  resource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    sourceType: string;
    endpoint?: string | null;
  } | null;
}

export type ResourceMetricSeriesMetric =
  | 'cpuPercent'
  | 'memoryPercent'
  | 'memoryUsageBytes'
  | 'networkInputBytes'
  | 'networkOutputBytes'
  | 'blockInputBytes'
  | 'blockOutputBytes'
  | 'pids';

export interface ResourceMetricSeriesPoint {
  snapshotId: string;
  sampledAt: string;
  value?: number | null;
  status: string;
}

export interface ResourceMetricSeries {
  id: string;
  resourceId: string;
  sourceType: string;
  provider: string;
  kind: string;
  metricSource: string;
  metric: ResourceMetricSeriesMetric;
  windowMinutes: number;
  limit: number;
  sampleCount: number;
  firstSampledAt: string;
  lastSampledAt: string;
  summary: ResourceMetricTrendValue;
  points: ResourceMetricSeriesPoint[];
  resource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    sourceType: string;
    endpoint?: string | null;
  } | null;
}
