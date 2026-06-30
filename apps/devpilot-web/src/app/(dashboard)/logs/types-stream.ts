/** 日志域类型 - 流/条目/会话/采集/保留相关接口。 */

import type {
  Project,
  Server,
  Site,
  ManagedResource,
  DeploymentRun,
  BackupPlan,
  AlertEvent,
} from './types';

export interface LogStreamMetadata {
  redaction?: {
    extraKeys?: string[];
    maskEmails?: boolean;
    maskIpAddresses?: boolean;
  };
  slsBackfill?: {
    enabled?: boolean;
    live?: boolean;
    confirmLiveRead?: boolean;
    query?: string;
    windowMinutes?: number;
    limit?: number;
    intervalMinutes?: number;
  };
  serverFollow?: {
    enabled?: boolean;
    live?: boolean;
    confirmLiveRead?: boolean;
    queue?: boolean;
    tail?: number;
    intervalMinutes?: number;
    maxAttempts?: number;
  };
  [key: string]: unknown;
}

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

export interface LogStream {
  id: string;
  name: string;
  sourceType: string;
  sourceKey?: string | null;
  status: string;
  retentionDays: number;
  lastEntryAt?: string | null;
  lastLevel?: string | null;
  lastMessage?: string | null;
  metadata?: LogStreamMetadata | null;
  project?: Project | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  applicationService?: { id: string; name: string; kind: string; status: string } | null;
  server?: Server | null;
  site?: Site | null;
  managedResource?: ManagedResource | null;
  deploymentRun?: DeploymentRun | null;
  backupPlan?: BackupPlan | null;
  backupRun?: { id: string; backupType: string; status: string; dryRun: boolean } | null;
  alertEvent?: AlertEvent | null;
  _count?: { entries: number };
}

export interface LogEntry {
  id: string;
  level: string;
  message: string;
  source?: string | null;
  timestamp: string;
  stream?: { id: string; name: string; sourceType: string; status: string } | null;
  project?: Project | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  applicationService?: { id: string; name: string; kind: string; status: string } | null;
  server?: Server | null;
  site?: Site | null;
  managedResource?: ManagedResource | null;
}

export interface LogTailResponse {
  streamId: string;
  limit: number;
  pollAfterMs: number;
  hasMore: boolean;
  cursor?: string | null;
  entries: LogEntry[];
}

export type LogStreamEventPayload = Partial<LogTailResponse> & {
  message?: string;
  at?: string;
  sessionId?: string;
  expiresAt?: string;
  maxSessionMs?: number;
  reason?: string;
};

export interface LogStreamSession {
  id: string;
  streamId: string;
  actorId: string;
  openedAt: string;
  expiresAt: string;
  maxSessionMs: number;
  pollIntervalMs: number;
  cursor?: string | null;
  lastEventAt: string;
  status: string;
  closeRequestedAt?: string | null;
  closeReason?: string | null;
}

export interface LogCollectionRun {
  id: string;
  sourceType: string;
  sourceKey?: string | null;
  executorKey: string;
  adapterKey: string;
  dryRun: boolean;
  tail: number;
  status: string;
  error?: string | null;
  ingestionStatus?: string | null;
  ingestedEntryCount?: number;
  ingestionError?: string | null;
  ingestedAt?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  serverExecutionJobId?: string | null;
  serverExecutionJob?: ServerExecutionJobRef | null;
  stream?: { id: string; name: string; sourceType: string; status: string } | null;
  server?: Server | null;
  managedResource?: ManagedResource | null;
}

export interface LogRetentionRun {
  id: string;
  streamId?: string | null;
  dryRun: boolean;
  retentionDays: number;
  cutoffAt: string;
  matchedEntryCount: number;
  deletedEntryCount: number;
  status: string;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  stream?: {
    id: string;
    name: string;
    sourceType: string;
    status: string;
    retentionDays: number;
  } | null;
}
