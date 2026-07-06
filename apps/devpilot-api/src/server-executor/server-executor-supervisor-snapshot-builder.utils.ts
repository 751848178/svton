import {
  SupervisorQueueCounts,
  SupervisorQueuedJobSample,
} from "./server-executor-supervisor.types";
import { RemoteOrphanStaleJob } from "./server-executor-supervisor-remote-orphan-input.types";
import { ServerExecutorSupervisorHost } from "./server-executor-supervisor-host.types";

export function buildRemoteOrphanInput(
  worker: WorkerSnapshot,
  now: Date,
  args: {
    staleRunningJobs: number;
    staleJobs: RemoteOrphanStaleJob[];
    activeOwners: number;
    staleOwners: number;
    expiredOwners: number;
  },
) {
  return {
    now,
    staleRemoteCleanupEnabled: worker.staleRemoteCleanupEnabled,
    recoveryBatchSize: worker.recoveryBatchSize,
    staleRunningJobs: args.staleRunningJobs,
    activeOwners: args.activeOwners,
    staleOwners: args.staleOwners,
    expiredOwners: args.expiredOwners,
    staleJobs: args.staleJobs,
  };
}

export function buildQueueCoordinationInput(
  worker: WorkerSnapshot,
  counts: {
    readyQueuedJobs: number;
    scheduledQueuedJobs: number;
    runningJobs: number;
    staleRunningJobs: number;
    blockedJobs: number;
  },
  owners: {
    total: number;
    active: number;
    stale: number;
    expired: number;
    unownedRunning: number;
  },
) {
  return {
    queueWorkerEnabled: worker.queueWorkerEnabled,
    processingQueue: worker.processingQueue,
    queueIntervalSeconds: worker.queueIntervalSeconds,
    queueBatchSize: worker.queueBatchSize,
    recoveryBatchSize: worker.recoveryBatchSize,
    staleRemoteCleanupEnabled: worker.staleRemoteCleanupEnabled,
    readyQueuedJobs: counts.readyQueuedJobs,
    scheduledQueuedJobs: counts.scheduledQueuedJobs,
    runningJobs: counts.runningJobs,
    staleRunningJobs: counts.staleRunningJobs,
    blockedJobs: counts.blockedJobs,
    totalOwners: owners.total,
    activeOwners: owners.active,
    staleOwners: owners.stale,
    expiredOwners: owners.expired,
    unownedRunningJobs: owners.unownedRunning,
  };
}

export type WorkerSnapshot = {
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
};

export function buildWorkerSnapshot(
  host: ServerExecutorSupervisorHost,
): WorkerSnapshot {
  return {
    workerId: host.getWorkerId(),
    queueWorkerEnabled: host.queueWorkerEnabled(),
    processingQueue: host.getProcessingQueue(),
    runningCancellations: host.getRunningCancellations(),
    queueIntervalSeconds: host.msToSeconds(host.queueWorkerIntervalMs()),
    queueBatchSize: host.queueWorkerBatchSize(),
    retryDelaySeconds: host.msToSeconds(host.queueRetryDelayMs()),
    queueLockTtlSeconds: host.msToSeconds(host.queueLockTtlMs()),
    queueHeartbeatSeconds: host.msToSeconds(host.queueLockHeartbeatMs()),
    cancellationPollSeconds: host.msToSeconds(host.cancellationPollMs()),
    recoveryBatchSize: host.queueRecoveryBatchSize(),
    staleRemoteCleanupEnabled: host.staleRemoteCleanupEnabled(),
  };
}

export function buildQueueSummary(
  nextQueuedJob: SupervisorQueuedJobSample | null,
  counts: SupervisorQueueCounts,
) {
  return {
    ready: counts.readyQueuedJobs,
    scheduled: counts.scheduledQueuedJobs,
    running: counts.runningJobs,
    staleRunning: counts.staleRunningJobs,
    blocked: counts.blockedJobs,
    failed: counts.failedJobs,
    cancelled: counts.cancelledJobs,
    nextQueuedJob: nextQueuedJob
      ? {
          id: nextQueuedJob.id,
          operationKey: nextQueuedJob.operationKey,
          adapterKey: nextQueuedJob.adapterKey,
          serverId: nextQueuedJob.serverId,
          priority: nextQueuedJob.priority,
          queuedAt: nextQueuedJob.queuedAt.toISOString(),
          availableAt: nextQueuedJob.availableAt.toISOString(),
          server: nextQueuedJob.server,
        }
      : null,
  };
}
