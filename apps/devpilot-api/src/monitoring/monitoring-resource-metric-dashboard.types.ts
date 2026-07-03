export type ResourceMetricDashboardValue = {
  latest: number | null;
  average: number | null;
  max: number | null;
  delta: number | null;
};

export type ResourceMetricDashboardResource = {
  id: string;
  name: string;
  sourceType: string;
  provider: string;
  kind: string;
  status: string;
  endpoint: string | null;
  project?: { id: string; name: string } | null;
  environment?: {
    id: string;
    key: string;
    name: string;
    status: string;
  } | null;
};

export type ResourceMetricDashboardRow = {
  id: string;
  resourceId: string;
  projectId: string | null;
  environmentId: string | null;
  sourceType: string;
  provider: string;
  kind: string;
  metricSource: string;
  status: "ok" | "warning" | "critical" | "stale";
  statusReason: string;
  sampleCount: number;
  firstSampledAt: Date;
  lastSampledAt: Date;
  minutesSinceLastSample: number;
  resource?: ResourceMetricDashboardResource | null;
  cpuPercent: ResourceMetricDashboardValue;
  memoryPercent: ResourceMetricDashboardValue;
  memoryUsageBytes: ResourceMetricDashboardValue;
  networkInputBytes: ResourceMetricDashboardValue;
  networkOutputBytes: ResourceMetricDashboardValue;
  blockInputBytes: ResourceMetricDashboardValue;
  blockOutputBytes: ResourceMetricDashboardValue;
  pids: ResourceMetricDashboardValue;
};

export type ResourceMetricDashboardSnapshot = {
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
  memoryLimitBytes?: number | null;
  memoryPercent: number | null;
  networkInputBytes: number | null;
  networkOutputBytes: number | null;
  blockInputBytes: number | null;
  blockOutputBytes: number | null;
  pids: number | null;
  resource?: ResourceMetricDashboardResource | null;
};
