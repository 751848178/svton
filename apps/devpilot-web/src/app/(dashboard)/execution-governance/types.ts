/** 执行治理域类型 - Job/Lease/远程执行/Agent 摘要接口。Supervisor 快照见 ./supervisor.ts */

export interface ServerExecutionLease {
  id: string;
  operationKey: string;
  adapterKey: string;
  transport: string;
  dryRun: boolean;
  status: string;
  activeKey?: string | null;
  metadata?: Record<string, unknown> | null;
  acquiredAt: string;
  releasedAt?: string | null;
  expiresAt: string;
  actor?: { id: string; name?: string | null; email: string } | null;
  server?: { id: string; name: string; host: string; status: string } | null;
}

export interface ServerExecutionJob {
  id: string;
  operationKey: string;
  adapterKey: string;
  transport: string;
  dryRun: boolean;
  status: string;
  queueMode: string;
  attempt: number;
  maxAttempts: number;
  error?: string | null;
  queuedAt: string;
  availableAt: string;
  lockedAt?: string | null;
  lockOwner?: string | null;
  lockExpiresAt?: string | null;
  lastHeartbeatAt?: string | null;
  cancelRequestedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  cancelledAt?: string | null;
  recoveredAt?: string | null;
  recoveryReason?: string | null;
  recoveryCount: number;
  metadata?: Record<string, unknown> | null;
  inputSnapshot?: unknown;
  result?: unknown;
  actor?: { id: string; name?: string | null; email: string } | null;
  server?: { id: string; name: string; host: string; status: string } | null;
  retryOf?: { id: string; status: string; operationKey: string; queuedAt: string } | null;
  retryAttempts?: { id: string; status: string; queuedAt: string; finishedAt?: string | null }[];
}

export interface RemoteExecutionSession {
  transport: string;
  pid: number;
  observedAt?: string;
  serverHost?: string;
  operationKey?: string;
  adapterKey?: string;
  cleanupStrategy?: string;
}

export interface RemoteExecutionCleanup {
  transport: string;
  pid?: number;
  observedAt?: string;
  reason?: string;
  attempted?: boolean;
  succeeded?: boolean;
  error?: string;
}

export interface RemoteExecutionSummaryData {
  session?: RemoteExecutionSession;
  cleanup?: RemoteExecutionCleanup;
  staleCleanup?: RemoteExecutionCleanup;
  updatedAt?: string;
}

export interface ExecutionAgentRef {
  source: string;
  referenceId: string;
  displayName: string;
  capabilityKey: string;
  status?: string;
  redacted?: boolean;
}

export interface ExecutionTargetSummaryData {
  transport: string;
  agentRef?: ExecutionAgentRef;
}

export interface AgentDispatchSummaryData {
  mode: string;
  executed?: boolean;
  agentExecutorEnabled?: boolean;
  dispatcherConfigured?: boolean;
  dispatcher?: string;
  serverExecutionJobId?: string;
  serverExecutionLeaseId?: string;
  retryAttempt?: number;
  maxAttempts?: number;
  dispatchId?: string;
  idempotencyKey?: string;
  responseStatus?: string;
  agentRunId?: string;
  nextExecutorBoundary?: string;
  responseError?: string;
}

const statusLabels: Record<string, string> = {
  queued: '排队中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  blocked: '已阻塞',
  cancelled: '已取消',
  expired: '已过期',
};

const statusClasses: Record<string, string> = {
  queued: 'bg-indigo-100 text-indigo-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  blocked: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-700',
  expired: 'bg-gray-100 text-gray-700',
};
