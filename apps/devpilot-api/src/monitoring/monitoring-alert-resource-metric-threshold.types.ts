export type ResourceMetricField = {
  key: string;
  label: string;
  unit: "percent" | "bytes" | "count";
};

export type ResourceMetricSample = {
  id: string;
  resourceId: string;
  resourceName: string;
  sampledAt: Date;
  status: string;
  value: number;
};

export type ResourceMetricSnapshotForEvaluation = {
  id: string;
  resourceId: string;
  sampledAt: Date;
  status: string;
  [key: string]: unknown;
  resource: { name: string } | null;
};

export type ResourceMetricThresholdValueInput = {
  metricName: string;
  metricField: ResourceMetricField;
  metricSource: string;
  windowMinutes: number;
  from: Date;
  to: Date;
  aggregation: string;
  operator: string;
  threshold: number;
  evaluatedValue: number;
  resourceId: string | null;
  samples: ResourceMetricSample[];
};
