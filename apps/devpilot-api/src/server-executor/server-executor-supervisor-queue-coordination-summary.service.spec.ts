import { ServerExecutorSupervisorQueueCoordinationSummaryService } from "./server-executor-supervisor-queue-coordination-summary.service";

describe("ServerExecutorSupervisorQueueCoordinationSummaryService", () => {
  it("reports ready multi-instance queue coordination when owners are healthy", () => {
    const summary =
      new ServerExecutorSupervisorQueueCoordinationSummaryService().summarize({
        queueWorkerEnabled: true,
        processingQueue: false,
        queueIntervalSeconds: 30,
        queueBatchSize: 5,
        recoveryBatchSize: 3,
        staleRemoteCleanupEnabled: true,
        readyQueuedJobs: 2,
        scheduledQueuedJobs: 1,
        runningJobs: 2,
        staleRunningJobs: 0,
        blockedJobs: 0,
        totalOwners: 2,
        activeOwners: 2,
        staleOwners: 0,
        expiredOwners: 0,
        unownedRunningJobs: 0,
      });

    expect(summary).toMatchObject({
      state: "ready",
      reason: "queue_coordination_ready",
      gates: {
        owners: {
          ready: true,
          activeOwners: 2,
          reason: "active_worker_owner",
        },
      },
      pressure: {
        backlogJobs: 3,
        totalOwners: 2,
        activeOwners: 2,
      },
      blockers: [],
      nextSteps: [
        {
          action: "ready_for_multi_instance_queue_coordination",
          reason: "queue_coordination_ready",
        },
      ],
    });
  });

  it("reports degraded coordination when running jobs have no active owner", () => {
    const summary =
      new ServerExecutorSupervisorQueueCoordinationSummaryService().summarize({
        queueWorkerEnabled: true,
        processingQueue: false,
        queueIntervalSeconds: 30,
        queueBatchSize: 5,
        recoveryBatchSize: 3,
        staleRemoteCleanupEnabled: true,
        readyQueuedJobs: 0,
        scheduledQueuedJobs: 0,
        runningJobs: 1,
        staleRunningJobs: 0,
        blockedJobs: 0,
        totalOwners: 0,
        activeOwners: 0,
        staleOwners: 0,
        expiredOwners: 0,
        unownedRunningJobs: 1,
      });

    expect(summary).toMatchObject({
      state: "degraded",
      reason: "unowned_running_jobs",
      gates: {
        owners: {
          ready: false,
          reason: "unowned_running_jobs",
        },
      },
      blockers: [
        {
          reason: "unowned_running_jobs",
          severity: "warning",
          count: 1,
        },
      ],
      nextSteps: [
        {
          action: "inspect_unowned_running_jobs",
          reason: "unowned_running_jobs",
        },
      ],
    });
  });
});
