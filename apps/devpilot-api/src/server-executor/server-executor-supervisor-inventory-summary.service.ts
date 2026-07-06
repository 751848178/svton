import { Injectable } from "@nestjs/common";
import { WorkerLockSummary } from "./server-executor-supervisor.types";
import { msToSupervisorSeconds } from "./server-executor-supervisor-host.types";

export type WorkerInventoryCurrent = {
  workerId: string;
  queueWorkerEnabled: boolean;
  processingQueue: boolean;
  runningCancellations: number;
  queueIntervalSeconds: number;
  queueBatchSize: number;
  queueLockTtlSeconds: number;
  queueHeartbeatSeconds: number;
  recoveryBatchSize: number;
  staleRemoteCleanupEnabled: boolean;
};

type WorkerInventoryStateInput = {
  queueWorkerEnabled: boolean;
  readyQueuedJobs: number;
  scheduledQueuedJobs: number;
  staleRunningJobs: number;
  activeOwners: number;
  staleOwners: number;
  expiredOwners: number;
};

function readWorkerInventoryState(input: WorkerInventoryStateInput) {
  if (
    !input.queueWorkerEnabled &&
    input.readyQueuedJobs + input.scheduledQueuedJobs > 0
  ) {
    return { state: "blocked", reason: "queue_worker_disabled" };
  }
  if (input.expiredOwners > 0)
    return { state: "degraded", reason: "expired_worker_owner" };
  if (input.staleOwners > 0 || input.staleRunningJobs > 0) {
    return { state: "degraded", reason: "stale_worker_owner" };
  }
  if (input.activeOwners > 0)
    return { state: "running", reason: "active_worker_owner" };
  if (input.queueWorkerEnabled)
    return { state: "running", reason: "queue_worker_enabled" };
  return { state: "idle", reason: "no_active_worker_owner" };
}

@Injectable()
export class ServerExecutorSupervisorInventorySummaryService {
  summarizeWorkerInventory(
    current: WorkerInventoryCurrent,
    workers: WorkerLockSummary[],
    counts: {
      readyQueuedJobs: number;
      scheduledQueuedJobs: number;
      runningJobs: number;
      staleRunningJobs: number;
      blockedJobs: number;
      now: Date;
    },
  ) {
    const ownerStats = workers.map((worker) => {
      const activeJobs = Math.max(0, worker.runningJobs - worker.staleJobs);
      const staleOwner = worker.staleJobs > 0;
      const expiredOwner =
        worker.runningJobs > 0 && worker.staleJobs >= worker.runningJobs;
      return { worker, activeJobs, staleOwner, expiredOwner };
    });
    const ownedRunningJobs = ownerStats.reduce(
      (total, item) => total + item.worker.runningJobs,
      0,
    );
    const ownedStaleJobs = ownerStats.reduce(
      (total, item) => total + item.worker.staleJobs,
      0,
    );
    const activeOwners = ownerStats.filter(
      (item) => item.activeJobs > 0,
    ).length;
    const staleOwners = ownerStats.filter((item) => item.staleOwner).length;
    const expiredOwners = ownerStats.filter((item) => item.expiredOwner).length;
    const unownedRunningJobs = Math.max(
      0,
      counts.runningJobs - ownedRunningJobs,
    );
    const state = readWorkerInventoryState({
      queueWorkerEnabled: current.queueWorkerEnabled,
      readyQueuedJobs: counts.readyQueuedJobs,
      scheduledQueuedJobs: counts.scheduledQueuedJobs,
      staleRunningJobs: counts.staleRunningJobs,
      activeOwners,
      staleOwners,
      expiredOwners,
    });

    return {
      current: {
        workerId: current.workerId,
        queueWorkerEnabled: current.queueWorkerEnabled,
        processingQueue: current.processingQueue,
        runningCancellations: current.runningCancellations,
        queueIntervalSeconds: current.queueIntervalSeconds,
        queueBatchSize: current.queueBatchSize,
        queueLockTtlSeconds: current.queueLockTtlSeconds,
        queueHeartbeatSeconds: current.queueHeartbeatSeconds,
        recoveryBatchSize: current.recoveryBatchSize,
        staleRemoteCleanupEnabled: current.staleRemoteCleanupEnabled,
      },
      status: state,
      queue: {
        ready: counts.readyQueuedJobs,
        scheduled: counts.scheduledQueuedJobs,
        running: counts.runningJobs,
        staleRunning: counts.staleRunningJobs,
        blocked: counts.blockedJobs,
        unownedRunning: unownedRunningJobs,
      },
      owners: {
        total: workers.length,
        active: activeOwners,
        stale: staleOwners,
        expired: expiredOwners,
        ownedRunningJobs,
        ownedStaleJobs,
        samples: ownerStats
          .slice(0, 10)
          .map(({ worker, activeJobs, expiredOwner, staleOwner }) => {
            const lastHeartbeatAt = worker.lastHeartbeatAt
              ? new Date(worker.lastHeartbeatAt)
              : null;
            const lockExpiresAt = worker.lockExpiresAt
              ? new Date(worker.lockExpiresAt)
              : null;
            return {
              lockOwner: worker.lockOwner,
              status: expiredOwner
                ? "expired"
                : staleOwner
                  ? "degraded"
                  : "running",
              runningJobs: worker.runningJobs,
              activeJobs,
              staleJobs: worker.staleJobs,
              lastHeartbeatAt: worker.lastHeartbeatAt,
              lockExpiresAt: worker.lockExpiresAt,
              lastHeartbeatAgeSeconds: lastHeartbeatAt
                ? Math.max(
                    0,
                    msToSupervisorSeconds(
                      counts.now.getTime() - lastHeartbeatAt.getTime(),
                    ),
                  )
                : null,
              lockExpiresInSeconds: lockExpiresAt
                ? msToSupervisorSeconds(
                    lockExpiresAt.getTime() - counts.now.getTime(),
                  )
                : null,
              sampleJob: worker.sampleJob,
            };
          }),
      },
    };
  }
}
