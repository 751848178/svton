import type { ExecutionAgentRef } from './types';
import type {
  ServerAgentRuntimeHealthSnapshot,
  SupervisorAgentRuntimeSnapshot,
  SupervisorAgentServerSample,
  SupervisorBlockedJobSample,
  SupervisorBlockedReason,
  SupervisorQueuedJobSample,
} from './supervisor-common.types';
import type {
  SupervisorAgentLifecyclePreflight,
  SupervisorAgentTaskPullReadiness,
} from './supervisor-agent-readiness.types';

export interface SupervisorAgentSnapshot {
  targetSelectionEnabled: boolean;
  totalServers: number;
  capableServers: number;
  serviceCapabilityServers: number;
  tagCapabilityServers: number;
  onlineCapableServers: number;
  runtime: SupervisorAgentRuntimeSummary;
  runtimeHealth: SupervisorAgentRuntimeHealthSummary;
  statusCounts: { status: string; count: number }[];
  dispatcher: SupervisorAgentDispatcherSnapshot;
  lifecyclePreflight: SupervisorAgentLifecyclePreflight;
  taskPullReadiness: SupervisorAgentTaskPullReadiness;
  jobs: SupervisorAgentJobsSnapshot;
  fleet: SupervisorAgentFleetSnapshot;
  samples: SupervisorAgentServerSample[];
}

export interface SupervisorAgentRuntimeSummary {
  heartbeatEnabled: boolean;
  tokenConfigured: boolean;
  requiredForTargetSelection: boolean;
  defaultTtlSeconds: number;
  heartbeatServers: number;
  onlineServers: number;
  staleServers: number;
  unknownServers: number;
}

export interface SupervisorAgentRuntimeHealthSummary {
  totalServers: number;
  readyServers: number;
  degradedServers: number;
  staleServers: number;
  unknownServers: number;
  missingHeartbeatServers: number;
  expiringSoonServers: number;
  statusCounts: { status: string; count: number }[];
  samples: {
    id: string;
    name: string;
    host: string;
    status: string;
    agentRef: ExecutionAgentRef;
    health: ServerAgentRuntimeHealthSnapshot;
  }[];
}

export interface SupervisorAgentDispatcherSnapshot {
  executorEnabled: boolean;
  dispatcherConfigured: boolean;
  dispatcherUrl?: string | null;
  timeoutSeconds: number;
  tokenConfigured: boolean;
}

export interface SupervisorAgentJobsSnapshot {
  ready: number;
  scheduled: number;
  running: number;
  staleRunning: number;
  blocked: number;
  failed: number;
  cancelled: number;
  nextQueuedJob?: SupervisorQueuedJobSample | null;
  blockedReasons: {
    scanned: number;
    dispatcherBoundaryJobs: number;
    reasonCounts: SupervisorBlockedReason[];
    samples: SupervisorBlockedJobSample[];
  };
}

export interface SupervisorAgentFleetSnapshot {
  totalServers: number;
  liveDispatchReadyServers: number;
  pressureServers: number;
  scannedJobs: number;
  truncated: boolean;
  items: SupervisorAgentFleetItem[];
}

export interface SupervisorAgentFleetItem extends SupervisorAgentServerSample {
  runtimeHealth: ServerAgentRuntimeHealthSnapshot;
  readiness: {
    targetReady: boolean;
    liveDispatchReady: boolean;
    blockingReasons: string[];
  };
  jobs: {
    ready: number;
    scheduled: number;
    running: number;
    staleRunning: number;
    blocked: number;
    failed: number;
    cancelled: number;
    pressure: number;
    nextQueuedJob?: SupervisorAgentFleetJobSample | null;
    runningProgress?: SupervisorAgentFleetJobSample | null;
    blockedSample?: SupervisorAgentFleetBlockedJobSample | null;
  };
}

export interface SupervisorAgentFleetJobSample extends SupervisorQueuedJobSample {
  status: string;
  finishedAt?: string | null;
  taskPullProgress?: SupervisorAgentTaskPullProgress | null;
}

export interface SupervisorAgentTaskPullProgress {
  updatedAt: string;
  agentId: string;
  runnerId?: string;
  stepKey?: string;
  message?: string;
  percent?: number;
}

export interface SupervisorAgentFleetBlockedJobSample extends SupervisorAgentFleetJobSample {
  reason: string;
  nextExecutorBoundary?: string;
  dispatcherConfigured?: boolean;
  agentExecutorEnabled?: boolean;
}
