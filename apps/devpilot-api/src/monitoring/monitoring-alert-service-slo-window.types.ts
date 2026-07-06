import type {
  ServiceSloAlertEvent,
  ServiceSloDeploymentRun,
  ServiceSloOperationRun,
  ServiceSloServiceRecord,
} from "./monitoring-service-slo-dashboard.types";

export type ServiceSloMatchPolicy = "any" | "all";

export type ServiceSloWindowSpec = {
  label: string;
  windowMinutes: number;
  targetPercent: number;
  burnRateThreshold: number;
};

export type ServiceSloWindowEvaluation = ServiceSloWindowSpec & {
  status: "ok" | "firing" | "no_data";
  statusReason: string;
  from: Date;
  to: Date;
  sloPercent: number | null;
  errorBudgetRemainingPercent: number | null;
  burnRate: number | null;
  deploymentCount: number;
  deploymentFailureCount: number;
  operationCount: number;
  operationFailureCount: number;
  alertImpactCount: number;
  criticalAlertCount: number;
  breachReasons: string[];
};

export type ServiceSloWindowSignals = {
  service: ServiceSloServiceRecord;
  deploymentRuns: ServiceSloDeploymentRun[];
  operationRuns: ServiceSloOperationRun[];
  alertEvents: ServiceSloAlertEvent[];
};
