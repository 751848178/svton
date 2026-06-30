/**
 * 审计事件域类型
 *
 * 单一职责：仅声明接口。
 */

export type AuditCategory =
  | 'deployment'
  | 'resource_action'
  | 'service_operation'
  | 'backup'
  | 'alert'
  | 'log'
  | string;

export type AuditRisk = 'low' | 'medium' | 'high' | string;
export type AuditStatus = 'running' | 'completed' | 'failed' | 'blocked' | string;

interface NamedRef {
  id: string;
  name?: string | null;
  email?: string;
}

export interface AuditEvent {
  id: string;
  category: AuditCategory;
  action: string;
  targetType: string;
  targetId?: string | null;
  risk: AuditRisk;
  status: AuditStatus;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt: string;
  actor?: NamedRef | null;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  application?: { id: string; name: string; status: string } | null;
  applicationService?: { id: string; name: string; kind: string; runtime?: string | null } | null;
  server?: { id: string; name: string; host: string } | null;
  site?: { id: string; name: string; primaryDomain: string } | null;
  managedResource?: {
    id: string;
    name: string;
    sourceType: string;
    provider: string;
    kind: string;
    endpoint?: string | null;
  } | null;
  deploymentRun?: { id: string; source: string; trigger: string; status: string } | null;
  resourceActionRun?: { id: string; action: string; status: string; dryRun: boolean } | null;
  applicationServiceOperationRun?: {
    id: string;
    action: string;
    status: string;
    dryRun: boolean;
  } | null;
  backupRun?: { id: string; backupType: string; status: string; dryRun: boolean } | null;
  alertEvent?: { id: string; metric: string; severity: string; status: string } | null;
  logStream?: { id: string; name: string; sourceType: string; status: string } | null;
  logEntry?: { id: string; level: string; message: string; timestamp: string } | null;
}

export interface AuditFilters {
  category: string;
  status: string;
  risk: string;
}

export interface AuditStats {
  total: number;
  deployments: number;
  resourceActions: number;
  serviceOperations: number;
  backups: number;
  alerts: number;
  logs: number;
  highRisk: number;
  failed: number;
}
