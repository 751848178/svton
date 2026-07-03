import type {
  SupervisorBlocker,
  SupervisorJobSample,
  SupervisorNextStep,
  SupervisorQueuedJobSample,
} from './supervisor-common.types';

export interface SupervisorWorkerSnapshot {
  workerId: string;
  queueWorkerEnabled: boolean;
  processingQueue: boolean;
  runningCancellations: number;
  queueIntervalSeconds: number;
  queueBatchSize: number;
  retryDelaySeconds: number;
  queueLockTtlSeconds: number;
  queueHeartbeatSeconds: number;
  cancellationPollSeconds: number;
  recoveryBatchSize: number;
  staleRemoteCleanupEnabled: boolean;
}

export interface SupervisorWorkerInventorySnapshot {
  current: Omit<SupervisorWorkerSnapshot, 'retryDelaySeconds' | 'cancellationPollSeconds'>;
  status: {
    state: 'running' | 'degraded' | 'blocked' | 'idle' | string;
    reason: string;
  };
  queue: {
    ready: number;
    scheduled: number;
    running: number;
    staleRunning: number;
    blocked: number;
    unownedRunning: number;
  };
  owners: {
    total: number;
    active: number;
    stale: number;
    expired: number;
    ownedRunningJobs: number;
    ownedStaleJobs: number;
    samples: SupervisorWorkerOwnerSample[];
  };
}

export interface SupervisorWorkerOwnerSample {
  lockOwner: string;
  status: 'running' | 'degraded' | 'expired' | string;
  runningJobs: number;
  activeJobs: number;
  staleJobs: number;
  lastHeartbeatAt?: string | null;
  lockExpiresAt?: string | null;
  lastHeartbeatAgeSeconds?: number | null;
  lockExpiresInSeconds?: number | null;
  sampleJob: SupervisorJobSample;
}

export interface SupervisorQueueCoordinationPreflight {
  state: 'ready' | 'degraded' | 'blocked' | 'idle' | string;
  reason: string;
  gates: {
    worker: {
      ready: boolean;
      enabled: boolean;
      processingQueue: boolean;
      batchSize: number;
      intervalSeconds: number;
      reason: string;
    };
    queue: {
      ready: boolean;
      readyJobs: number;
      scheduledJobs: number;
      runningJobs: number;
      blockedJobs: number;
      backlogJobs: number;
      reason: string;
    };
    owners: {
      ready: boolean;
      totalOwners: number;
      activeOwners: number;
      staleOwners: number;
      expiredOwners: number;
      unownedRunningJobs: number;
      reason: string;
    };
    recovery: {
      ready: boolean;
      staleRunningJobs: number;
      recoveryBatchSize: number;
      staleRemoteCleanupEnabled: boolean;
      reason: string;
    };
  };
  pressure: {
    backlogJobs: number;
    readyJobs: number;
    scheduledJobs: number;
    runningJobs: number;
    staleRunningJobs: number;
    blockedJobs: number;
    totalOwners: number;
    activeOwners: number;
    staleOwners: number;
    unownedRunningJobs: number;
  };
  blockers: SupervisorBlocker[];
  nextSteps: SupervisorNextStep[];
}

export interface SupervisorQueueSnapshot {
  ready: number;
  scheduled: number;
  running: number;
  staleRunning: number;
  blocked: number;
  failed: number;
  cancelled: number;
  nextQueuedJob?: SupervisorQueuedJobSample | null;
}

export interface SupervisorLeaseSnapshot {
  running: number;
  expired: number;
  blocked: number;
}

export interface SupervisorWorkerOwnerSnapshot {
  lockOwner: string;
  runningJobs: number;
  staleJobs: number;
  lastHeartbeatAt?: string | null;
  lockExpiresAt?: string | null;
  sampleJob: SupervisorJobSample;
}
