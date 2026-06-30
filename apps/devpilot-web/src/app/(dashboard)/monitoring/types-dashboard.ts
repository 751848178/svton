/** 监控域类型 - 仪表盘与 SLO 接口。 */

export interface ResourceMetricDashboardValue {
  latest?: number | null;
  average?: number | null;
  max?: number | null;
  delta?: number | null;
}

export interface ResourceMetricDashboardRow {
  id: string;
  resourceId: string;
  sourceType: string;
  provider: string;
  kind: string;
  metricSource: string;
  status: 'ok' | 'warning' | 'critical' | 'stale';
  statusReason: string;
  sampleCount: number;
  firstSampledAt: string;
  lastSampledAt: string;
  minutesSinceLastSample: number;
  resource?: {
    id: string;
    name: string;
    sourceType: string;
    provider: string;
    kind: string;
    status: string;
    endpoint?: string | null;
    project?: Project | null;
    environment?: { id: string; key: string; name: string; status: string } | null;
  } | null;
  cpuPercent: ResourceMetricDashboardValue;
  memoryPercent: ResourceMetricDashboardValue;
  memoryUsageBytes: ResourceMetricDashboardValue;
  networkInputBytes: ResourceMetricDashboardValue;
  networkOutputBytes: ResourceMetricDashboardValue;
  blockInputBytes: ResourceMetricDashboardValue;
  blockOutputBytes: ResourceMetricDashboardValue;
  pids: ResourceMetricDashboardValue;
}

export interface ResourceMetricDashboard {
  generatedAt: string;
  windowMinutes: number;
  staleAfterMinutes: number;
  resourceCount: number;
  sampleCount: number;
  okCount: number;
  warningCount: number;
  criticalCount: number;
  staleCount: number;
  maxCpuPercent?: number | null;
  maxMemoryPercent?: number | null;
  maxPids?: number | null;
  rows: ResourceMetricDashboardRow[];
}

export type ServiceSloStatus = 'ok' | 'warning' | 'critical' | 'no_data';

export interface ServiceSloDashboardRow {
  id: string;
  serviceId: string;
  projectId: string;
  environmentId: string;
  applicationId: string;
  status: ServiceSloStatus;
  statusReason: string;
  targetPercent: number;
  sloPercent?: number | null;
  errorBudgetRemainingPercent?: number | null;
  burnRate?: number | null;
  deploymentCount: number;
  deploymentSuccessCount: number;
  deploymentFailureCount: number;
  operationCount: number;
  operationSuccessCount: number;
  operationFailureCount: number;
  alertImpactCount: number;
  criticalAlertCount: number;
  service: {
    id: string;
    name: string;
    kind: string;
    status: string;
    runtime?: string | null;
    project?: { id: string; name: string } | null;
    environment?: { id: string; key: string; name: string; status: string } | null;
    application?: { id: string; name: string; status: string } | null;
  };
}

export interface ServiceSloDashboard {
  generatedAt: string;
  windowMinutes: number;
  targetPercent: number;
  serviceCount: number;
  okCount: number;
  warningCount: number;
  criticalCount: number;
  noDataCount: number;
  averageSloPercent?: number | null;
  deploymentCount: number;
  deploymentFailureCount: number;
  operationCount: number;
  operationFailureCount: number;
  alertImpactCount: number;
  criticalAlertCount: number;
  rows: ServiceSloDashboardRow[];
}

export interface ServiceSloRuleTemplate {
  id: string;
  name: string;
  description: string;
  targetType: 'service_slo' | 'service_error_budget' | 'service_error_budget_exhaustion';
  category: 'service';
  metric: 'service_slo_breach' | 'service_error_budget' | 'service_error_budget_exhaustion';
  severity: 'warning' | 'critical';
  evaluationMode: 'manual' | 'schedule';
  intervalSeconds: number;
  condition: Record<string, unknown>;
}

import type { Project } from './types';

export type TargetType =
  | 'service'
  | 'service_slo'
  | 'service_error_budget'
  | 'service_error_budget_exhaustion'
  | 'server'
  | 'site'
  | 'site_certificate'
  | 'site_certificate_asset'
  | 'site_tls_renewal'
  | 'site_smoke_check'
  | 'resource'
  | 'resource_metric'
  | 'backup'
  | 'deployment'
  | 'deployment_smoke_check'
  | 'cloud_sync'
  | 'log';
