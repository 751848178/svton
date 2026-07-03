import type {
  SupervisorActorRef,
  SupervisorEnvironmentRef,
  SupervisorProjectRef,
  SupervisorServerRef,
} from './supervisor-common.types';

export interface SupervisorExecutionAuditVisibility {
  totalRecent: number;
  failedRecent: number;
  blockedRecent: number;
  highRiskRecent: number;
  statuses: { status: string; count: number }[];
  risks: { risk: string; count: number }[];
  actions: { action: string; count: number }[];
  samples: SupervisorExecutionAuditSample[];
}

export interface SupervisorExecutionAuditSample {
  id: string;
  action: string;
  targetId?: string | null;
  serverExecutionJobId?: string | null;
  risk: string;
  status: string;
  summary?: string | null;
  occurredAt: string;
  actor?: SupervisorActorRef | null;
  project?: SupervisorProjectRef | null;
  environment?: SupervisorEnvironmentRef | null;
  server?: SupervisorServerRef | null;
  metadata?: {
    serverExecutionJobId?: string | null;
    operationKey?: string;
    adapterKey?: string;
    transport?: string;
    queueMode?: string;
    dryRun?: boolean;
    attempt?: number;
    maxAttempts?: number;
    resultStatus?: string;
    resultMode?: string;
  };
}
