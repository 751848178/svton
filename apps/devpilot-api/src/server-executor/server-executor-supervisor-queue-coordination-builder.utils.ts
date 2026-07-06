import {
  QueueCoordinationPreflightSeverity,
  QueueCoordinationPreflightState,
} from "./server-executor-supervisor.types";

export type QueueCoordinationPreflightInput = {
  queueWorkerEnabled: boolean;
  processingQueue: boolean;
  queueIntervalSeconds: number;
  queueBatchSize: number;
  recoveryBatchSize: number;
  staleRemoteCleanupEnabled: boolean;
  readyQueuedJobs: number;
  scheduledQueuedJobs: number;
  runningJobs: number;
  staleRunningJobs: number;
  blockedJobs: number;
  totalOwners: number;
  activeOwners: number;
  staleOwners: number;
  expiredOwners: number;
  unownedRunningJobs: number;
};

export type QueueCoordinationCollector = {
  blockers: {
    reason: string;
    severity: QueueCoordinationPreflightSeverity;
    count: number;
  }[];
  nextSteps: { action: string; reason: string }[];
};

export function resolveQueueCoordinationState(
  input: QueueCoordinationPreflightInput,
  backlogJobs: number,
  pressureJobs: number,
  collector: QueueCoordinationCollector,
): { state: QueueCoordinationPreflightState; reason: string } {
  const configured =
    input.queueWorkerEnabled || pressureJobs > 0 || input.totalOwners > 0;
  const criticalBlocker = collector.blockers.find(
    (b) => b.severity === "critical",
  );
  const warningBlocker = collector.blockers.find(
    (b) => b.severity === "warning",
  );
  let state: QueueCoordinationPreflightState = "ready";
  if (!configured) state = "idle";
  else if (criticalBlocker) state = "blocked";
  else if (warningBlocker) state = "degraded";
  const reason =
    state === "idle"
      ? "queue_coordination_idle"
      : criticalBlocker?.reason ||
        warningBlocker?.reason ||
        "queue_coordination_ready";
  return { state, reason };
}

export function buildQueueCoordinationResult(
  input: QueueCoordinationPreflightInput,
  backlogJobs: number,
  state: QueueCoordinationPreflightState,
  reason: string,
  collector: QueueCoordinationCollector,
) {
  return {
    state,
    reason,
    gates: {
      worker: buildWorkerGate(input),
      queue: buildQueueGate(input, backlogJobs),
      owners: buildOwnersGate(input),
      recovery: buildRecoveryGate(input),
    },
    pressure: {
      backlogJobs,
      readyJobs: input.readyQueuedJobs,
      scheduledJobs: input.scheduledQueuedJobs,
      runningJobs: input.runningJobs,
      staleRunningJobs: input.staleRunningJobs,
      blockedJobs: input.blockedJobs,
      totalOwners: input.totalOwners,
      activeOwners: input.activeOwners,
      staleOwners: input.staleOwners,
      unownedRunningJobs: input.unownedRunningJobs,
    },
    blockers: collector.blockers,
    nextSteps: collector.nextSteps,
  };
}

function buildWorkerGate(input: QueueCoordinationPreflightInput) {
  return {
    ready: input.queueWorkerEnabled,
    enabled: input.queueWorkerEnabled,
    processingQueue: input.processingQueue,
    batchSize: input.queueBatchSize,
    intervalSeconds: input.queueIntervalSeconds,
    reason: input.queueWorkerEnabled
      ? input.processingQueue
        ? "processing_queue"
        : "queue_worker_enabled"
      : "queue_worker_disabled",
  };
}

function buildQueueGate(
  input: QueueCoordinationPreflightInput,
  backlogJobs: number,
) {
  return {
    ready:
      input.queueWorkerEnabled || backlogJobs === 0 || input.activeOwners > 0,
    readyJobs: input.readyQueuedJobs,
    scheduledJobs: input.scheduledQueuedJobs,
    runningJobs: input.runningJobs,
    blockedJobs: input.blockedJobs,
    backlogJobs,
    reason:
      backlogJobs > 0
        ? "queue_backlog_active"
        : input.runningJobs > 0
          ? "running_jobs_active"
          : input.blockedJobs > 0
            ? "blocked_jobs_present"
            : "queue_idle",
  };
}

function buildOwnersGate(input: QueueCoordinationPreflightInput) {
  return {
    ready:
      input.expiredOwners === 0 &&
      input.staleOwners === 0 &&
      input.unownedRunningJobs === 0 &&
      (input.runningJobs === 0 || input.activeOwners > 0),
    totalOwners: input.totalOwners,
    activeOwners: input.activeOwners,
    staleOwners: input.staleOwners,
    expiredOwners: input.expiredOwners,
    unownedRunningJobs: input.unownedRunningJobs,
    reason:
      input.expiredOwners > 0
        ? "expired_worker_owner"
        : input.staleOwners > 0
          ? "stale_worker_owner"
          : input.unownedRunningJobs > 0
            ? "unowned_running_jobs"
            : input.activeOwners > 0
              ? "active_worker_owner"
              : "no_running_job_owner",
  };
}

function buildRecoveryGate(input: QueueCoordinationPreflightInput) {
  return {
    ready: input.staleRunningJobs === 0,
    staleRunningJobs: input.staleRunningJobs,
    recoveryBatchSize: input.recoveryBatchSize,
    staleRemoteCleanupEnabled: input.staleRemoteCleanupEnabled,
    reason:
      input.staleRunningJobs > 0
        ? input.staleRemoteCleanupEnabled
          ? "stale_running_jobs"
          : "stale_remote_cleanup_disabled"
        : "stale_recovery_ready",
  };
}
