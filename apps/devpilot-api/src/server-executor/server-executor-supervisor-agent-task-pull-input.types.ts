import { WorkerLockServer } from "./server-executor-supervisor.types";

export type AgentTaskPullReadinessInput = {
  targetSelectionEnabled: boolean;
  capableServers: number;
  onlineCapableServers: number;
  heartbeatEnabled: boolean;
  heartbeatTokenConfigured: boolean;
  heartbeatRequiredForTargetSelection: boolean;
  heartbeatServers: number;
  taskPullContractEnabled: boolean;
  taskPullEnabled: boolean;
  runtimeReadyServers: number;
  runtimeIssueServers: number;
  missingHeartbeatServers: number;
  queueWorkerEnabled: boolean;
  agentReadyJobs: number;
  agentScheduledJobs: number;
  agentRunningJobs: number;
  agentStaleRunningJobs: number;
  agentBlockedJobs: number;
  agentFailedJobs: number;
  agentCancelledJobs: number;
  nextQueuedJob: {
    id: string;
    operationKey: string;
    adapterKey: string;
    serverId: string | null;
    priority: number;
    queuedAt: string;
    availableAt: string;
    server: WorkerLockServer;
  } | null;
  blockedReasonSummary: {
    scanned: number;
    dispatcherBoundaryJobs: number;
    reasonCounts: {
      reason: string;
      count: number;
      nextExecutorBoundary?: string;
    }[];
    samples: {
      id: string;
      operationKey: string;
      adapterKey: string;
      serverId: string | null;
      queuedAt: string;
      finishedAt: string | null;
      server: WorkerLockServer;
      reason: string;
      nextExecutorBoundary?: string;
      dispatcherConfigured?: boolean;
      agentExecutorEnabled?: boolean;
    }[];
  };
  auditTotalRecent: number;
  auditFailedRecent: number;
  auditBlockedRecent: number;
  auditHighRiskRecent: number;
};
