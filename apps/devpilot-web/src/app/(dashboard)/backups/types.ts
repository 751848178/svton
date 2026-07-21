/**
 * 备份域类型定义
 *
 * 单一职责：仅声明接口，不含逻辑。
 */

export interface ServerExecutionJobRef {
  id: string;
  status: string;
  queueMode: string;
  attempt: number;
  maxAttempts: number;
  queuedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface ManagedResource {
  id: string;
  sourceType: 'server' | 'cloud' | 'manual';
  provider: string;
  kind: string;
  name: string;
  endpoint?: string | null;
  status: string;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  server?: { id: string; name: string; host: string; status?: string } | null;
}

export interface BackupPlanRun {
  id: string;
  status: string;
  dryRun: boolean;
  trigger: string;
  startedAt: string;
  finishedAt?: string | null;
  error?: string | null;
  serverExecutionJob?: ServerExecutionJobRef | null;
}

export interface BackupPlan {
  id: string;
  name: string;
  backupType: string;
  schedule?: string | null;
  retentionDays: number;
  destinationType: string;
  status: 'active' | 'paused' | 'archived' | string;
  lastRunAt?: string | null;
  lastStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  resource?: ManagedResource | null;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  server?: { id: string; name: string; host: string; status?: string } | null;
  runs?: BackupPlanRun[];
}

export interface BackupRun {
  id: string;
  trigger: string;
  backupType: string;
  executorKey: string;
  adapterKey: string;
  dryRun: boolean;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | string;
  serverExecutionJobId?: string | null;
  serverExecutionJob?: ServerExecutionJobRef | null;
  destinationType: string;
  startedAt: string;
  finishedAt?: string | null;
  error?: string | null;
  plan?: { id: string; name: string; status: string; schedule?: string | null } | null;
  resource?: ManagedResource | null;
  server?: { id: string; name: string; host: string } | null;
}

export interface BackupPlanInput {
  resourceId: string;
  name: string;
  backupType?: string;
  retentionDays: number;
  destinationType: string;
}

/** 恢复确认弹窗的最小目标信息（RunList 与 PlanCard run chips 共用）。 */
export interface BackupRestoreTarget {
  id: string;
  name: string;
}

export interface BackupStats {
  total: number;
  active: number;
  blockedRuns: number;
  failedRuns: number;
}
