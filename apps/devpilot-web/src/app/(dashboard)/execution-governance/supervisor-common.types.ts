import type { ExecutionAgentRef } from './types';

export interface SupervisorServerRef {
  id: string;
  name: string;
  host: string;
  status: string;
}

export interface SupervisorActorRef {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface SupervisorProjectRef {
  id: string;
  name: string;
}

export interface SupervisorEnvironmentRef {
  id: string;
  key: string;
  name: string;
  status: string;
}

export interface SupervisorBlocker {
  reason: string;
  severity: 'critical' | 'warning' | string;
  count: number;
}

export interface SupervisorNextStep {
  action: string;
  reason: string;
}

export interface SupervisorJobSample {
  id: string;
  operationKey: string;
  adapterKey: string;
  serverId?: string | null;
  server?: SupervisorServerRef | null;
}

export interface SupervisorQueuedJobSample extends SupervisorJobSample {
  priority: number;
  queuedAt: string;
  availableAt: string;
}

export interface SupervisorBlockedReason {
  reason: string;
  count: number;
  nextExecutorBoundary?: string;
}

export interface SupervisorBlockedJobSample extends SupervisorJobSample {
  queuedAt: string;
  finishedAt?: string | null;
  reason: string;
  nextExecutorBoundary?: string;
  dispatcherConfigured?: boolean;
  agentExecutorEnabled?: boolean;
}

export interface ServerAgentRuntimeHealthSnapshot {
  state: 'ready' | 'degraded' | 'stale' | 'unknown' | 'missing' | string;
  reason: string;
  expiringSoon: boolean;
  capabilities: string[];
  status?: string;
  lastSeenAgeSeconds?: number;
  expiresInSeconds?: number;
  heartbeatTtlSeconds?: number;
}

export interface SupervisorAgentRuntimeSnapshot {
  state: string;
  status?: string;
  agentId?: string;
  runnerId?: string;
  hostname?: string;
  version?: string;
  lastSeenAt?: string;
  expiresAt?: string;
  heartbeatTtlSeconds?: number;
  capabilities: string[];
}

export interface SupervisorAgentServerSample {
  id: string;
  name: string;
  host: string;
  status: string;
  agentRef: ExecutionAgentRef;
  runtime?: SupervisorAgentRuntimeSnapshot;
}
