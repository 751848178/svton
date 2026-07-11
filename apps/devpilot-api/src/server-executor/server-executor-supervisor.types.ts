import { Prisma } from "@prisma/client";

export type WorkerLockServer = {
  id: string;
  name: string;
  host: string;
  status: string;
} | null;

export type WorkerLockRecord = {
  id: string;
  operationKey: string;
  adapterKey: string;
  serverId: string | null;
  lockOwner: string | null;
  lastHeartbeatAt: Date | null;
  lockExpiresAt: Date | null;
  server: WorkerLockServer;
};

export type WorkerLockSummary = {
  lockOwner: string;
  runningJobs: number;
  staleJobs: number;
  lastHeartbeatAt: string | null;
  lockExpiresAt: string | null;
  sampleJob: {
    id: string;
    operationKey: string;
    adapterKey: string;
    serverId: string | null;
    server: WorkerLockServer;
  };
};

export type ExecutionAuditEventRecord = {
  id: string;
  action: string;
  targetId: string | null;
  risk: string;
  status: string;
  summary: string | null;
  metadata: Prisma.JsonValue | null;
  occurredAt: Date;
  actor: { id: string; name: string | null; email: string | null } | null;
  project: { id: string; name: string } | null;
  environment: { id: string; key: string; name: string; status: string } | null;
  server: WorkerLockServer;
};

export type ServerAgentReadinessRecord = {
  id: string;
  name: string;
  host: string;
  status: string;
  services: Prisma.JsonValue | null;
  tags: Prisma.JsonValue | null;
};

export type ServerAgentBlockedJobRecord = {
  id: string;
  operationKey: string;
  adapterKey: string;
  serverId: string | null;
  queuedAt: Date;
  finishedAt: Date | null;
  error: string | null;
  result: Prisma.JsonValue | null;
  server: WorkerLockServer;
};

export type ServerAgentFleetJobRecord = ServerAgentBlockedJobRecord & {
  status: string;
  queueMode: string;
  priority: number;
  availableAt: Date;
  lockExpiresAt: Date | null;
  metadata: Prisma.JsonValue | null;
};

export type ServerAgentTaskPullProgressSnapshot = {
  updatedAt: string;
  agentId: string;
  runnerId?: string;
  stepKey?: string;
  message?: string;
  percent?: number;
};

export type ServerAgentDispatcherConfig = {
  executorEnabled: boolean;
  dispatcherConfigured: boolean;
  dispatcherUrl: string | null;
  timeoutSeconds: number;
  tokenConfigured: boolean;
};

export type ServerAgentRuntimeSummary = {
  state: "online" | "stale" | "unknown";
  status?: string;
  agentId?: string;
  runnerId?: string;
  hostname?: string;
  version?: string;
  lastSeenAt?: string;
  expiresAt?: string;
  heartbeatTtlSeconds?: number;
  capabilities: string[];
};

export type ServerAgentRuntimeHealthState =
  | "ready"
  | "degraded"
  | "stale"
  | "unknown"
  | "missing";

export type ServerAgentRuntimeHealthSummary = {
  state: ServerAgentRuntimeHealthState;
  reason: string;
  expiringSoon: boolean;
  capabilities: string[];
  status?: string;
  lastSeenAgeSeconds?: number;
  expiresInSeconds?: number;
  heartbeatTtlSeconds?: number;
};

export type ServerAgentLifecyclePreflightState =
  | "ready"
  | "degraded"
  | "blocked"
  | "disabled";
export type ServerAgentLifecyclePreflightSeverity = "critical" | "warning";
export type ServerAgentTaskPullReadinessState =
  | "ready"
  | "degraded"
  | "blocked"
  | "idle";
export type ServerAgentTaskPullReadinessSeverity = "critical" | "warning";
export type QueueCoordinationPreflightState =
  | "ready"
  | "degraded"
  | "blocked"
  | "idle";
export type QueueCoordinationPreflightSeverity = "critical" | "warning";
export type RemoteOrphanGovernancePreflightState =
  | "ready"
  | "degraded"
  | "blocked"
  | "idle";
export type RemoteOrphanGovernancePreflightSeverity = "critical" | "warning";

export type ServerAgentCapabilityRef = NonNullable<{
  source: "server_services" | "server_tags";
  referenceId: string;
  displayName: string;
  capabilityKey: string;
  status?: string;
  redacted: true;
}>;

export type ServerAgentCapabilityRecord = Pick<
  {
    id: string;
    name: string;
    services: Prisma.JsonValue | null;
    tags: Prisma.JsonValue | null;
  },
  "id" | "name" | "services" | "tags"
>;

export type SupervisorQueuedJobSample = {
  id: string;
  operationKey: string;
  adapterKey: string;
  serverId: string | null;
  priority: number;
  queuedAt: Date;
  availableAt: Date;
  server: { id: string; name: string; host: string; status: string } | null;
};

export type SupervisorQueueCounts = {
  readyQueuedJobs: number;
  scheduledQueuedJobs: number;
  runningJobs: number;
  staleRunningJobs: number;
  blockedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
};
