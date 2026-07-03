export type ServiceSloDashboardStatus =
  | "ok"
  | "warning"
  | "critical"
  | "no_data";

export type ServiceSloServiceRecord = {
  id: string;
  projectId: string;
  environmentId: string;
  applicationId: string;
  name: string;
  kind: string;
  status: string;
  runtime: string | null;
  project?: { id: string; name: string } | null;
  environment?: {
    id: string;
    key: string;
    name: string;
    status: string;
  } | null;
  application?: { id: string; name: string; status: string } | null;
};

export type ServiceSloDashboardRow = {
  id: string;
  serviceId: string;
  projectId: string;
  environmentId: string;
  applicationId: string;
  status: ServiceSloDashboardStatus;
  statusReason: string;
  targetPercent: number;
  sloPercent: number | null;
  errorBudgetRemainingPercent: number | null;
  burnRate: number | null;
  deploymentCount: number;
  deploymentSuccessCount: number;
  deploymentFailureCount: number;
  operationCount: number;
  operationSuccessCount: number;
  operationFailureCount: number;
  alertImpactCount: number;
  criticalAlertCount: number;
  service: ServiceSloServiceRecord;
};

export type ServiceSloDeploymentRun = {
  applicationServiceId: string | null;
  status: string;
  startedAt: Date;
};

export type ServiceSloOperationRun = {
  applicationServiceId: string;
  status: string;
  startedAt: Date;
};

export type ServiceSloAlertEvent = {
  applicationServiceId: string | null;
  severity: string;
  status: string;
  occurredAt: Date;
};
